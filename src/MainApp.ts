/*

Goals:
- state should be immutable and data-only.
- app should be the container for the state/dispatch loop.
- plugins should implement and manage the side-effects.

*/

import { BrowserWindow, app, Menu } from "electron"
import { differenceBy, flatten, intersectionBy, throttle } from "lodash"
import * as path from "path"
import { MainApp, MainAppAction, MainAppPlugin, MainAppState } from "./state"

// ==================================================================
// State
// ==================================================================

type WindowRect = {
	x: number
	y: number
	width: number
	height: number
}

type WindowState = {
	id: string
	rect: WindowRect
}

declare module "./state" {
	interface MainAppState {
		windows: WindowState[]
	}
}

// ==================================================================
// Action
// ==================================================================

type NewWindowAction = { type: "new-window" }

type CloseWindowAction = { type: "close-window"; id: string }

type MoveWindowAction = {
	type: "move-window"
	id: string
	x: number
	y: number
}

type ResizeWindowAction = {
	type: "resize-window"
	id: string
	width: number
	height: number
}

type FocusWindowAction = { type: "focus-window"; id: string }

declare module "./state" {
	interface MainAppActions {
		newWindowAction: NewWindowAction
		closeWindowAction: CloseWindowAction
		moveWindowAction: MoveWindowAction
		resizeWindowAction: ResizeWindowAction
		focusWindowAction: FocusWindowAction
	}
}

// ==================================================================
// Reducers
// ==================================================================

function newWindow(state: MainAppState, action: NewWindowAction): MainAppState {
	const { windows } = state
	const [focused] = windows

	const window: WindowState = {
		id: randomId(),
		rect: focused
			? {
					x: focused.rect.x + 20,
					y: focused.rect.y + 20,
					width: focused.rect.width,
					height: focused.rect.height,
			  }
			: initialRect(),
	}
	return {
		...state,
		windows: [window, ...windows],
	}
}

function closeWindow(
	state: MainAppState,
	action: CloseWindowAction
): MainAppState {
	const { windows } = state
	const { id } = action

	return {
		...state,
		windows: windows.filter((win) => win.id !== id),
	}
}

function moveWindow(
	state: MainAppState,
	action: MoveWindowAction
): MainAppState {
	const { windows } = state
	const { id, x, y } = action
	return {
		...state,
		windows: windows.map((win) => {
			if (win.id !== id) return win
			return {
				id,
				rect: { ...win.rect, x, y },
			}
		}),
	}
}

function resizeWindow(
	state: MainAppState,
	action: ResizeWindowAction
): MainAppState {
	const { windows } = state
	const { id, width, height } = action
	return {
		...state,
		windows: windows.map((win) => {
			if (win.id !== id) return win
			return {
				id,
				rect: { ...win.rect, width, height },
			}
		}),
	}
}

function focusWindow(
	state: MainAppState,
	action: FocusWindowAction
): MainAppState {
	const { windows } = state
	const [focused] = windows
	const { id } = action

	if (focused.id === id) return state

	const newFocused = windows.find((win) => win.id === id)
	if (!newFocused) return state

	const newOthers = windows.filter((win) => win.id !== id)
	return {
		...state,
		windows: [newFocused, ...newOthers],
	}
}

function randomId() {
	return Math.random().toString().slice(3, 13)
}

function initialRect(): WindowRect {
	return {
		height: 600,
		width: 800,
		x: 200,
		y: 200,
	}
}

export function initMainState(): MainAppState {
	const windowState = {
		id: randomId(),
		rect: initialRect(),
	}
	return {
		windows: [windowState],
	}
}

export function updateMainState(
	state: MainAppState,
	action: MainAppAction
): MainAppState {
	switch (action.type) {
		case "new-window":
			return newWindow(state, action)
		case "close-window":
			return closeWindow(state, action)
		case "move-window":
			return moveWindow(state, action)
		case "resize-window":
			return resizeWindow(state, action)
		case "focus-window":
			return focusWindow(state, action)
	}
}

// ==================================================================
// "State Plugin" example.
// ==================================================================

// Imagine a "plugin" that organizes windows for us. It's a bit contrived here,
// but it demonstrated the concept.
export function organizeWindows(state: MainAppState) {
	return {
		...state,
		windows: state.windows.map((win, i) => {
			if (i === 0) return win
			const { rect: prev } = state.windows[i - 1]
			return {
				...win,
				rect: {
					x: prev.x + 20,
					y: prev.y + 20,
					width: prev.width,
					height: prev.height,
				},
			}
		}),
	}
}

// ==================================================================
// ElectronWindowPlugin
// ==================================================================

export const ElectronWindowPlugin: MainAppPlugin = (app) => {
	return new ElectronWindowManager(app)
}

class ElectronWindowManager {
	private browserWindows: { [id: string]: BrowserWindow | undefined } = {}

	constructor(private app: MainApp) {
		const { windows } = app.state
		const focused = windows[0]
		const reversed = [...windows].reverse()
		for (const windowState of reversed) {
			const browserWindow = this.initWindow(windowState)
			if (windowState === focused) browserWindow.focus()
		}
	}

	private initWindow(windowState: WindowState) {
		const browserWindow = createWindow(windowState.rect)
		this.browserWindows[windowState.id] = browserWindow

		browserWindow.on("close", () => {
			this.app.dispatch({ type: "close-window", id: windowState.id })
		})

		browserWindow.on("moved", () => {
			// TODO: ideally this doesn't fire during the animation...
			// We can deal with that later.
			const [x, y] = browserWindow.getPosition()
			if (windowState.rect.x !== x || windowState.rect.y !== y)
				this.app.dispatch({ type: "move-window", id: windowState.id, x, y })
		})

		browserWindow.on("resized", () => {
			const [width, height] = browserWindow.getSize()
			if (
				windowState.rect.height !== height ||
				windowState.rect.width !== width
			)
				this.app.dispatch({
					type: "resize-window",
					id: windowState.id,
					width,
					height,
				})
		})
		browserWindow.on("focus", () => {
			if (this.app.state.windows[0]?.id !== windowState.id)
				this.app.dispatch({ type: "focus-window", id: windowState.id })
		})

		return browserWindow
	}

	update(prevState: MainAppState) {
		const nextState = this.app.state
		if (nextState === prevState) return
		if (nextState.windows === prevState.windows) return

		const nextWindows = nextState.windows
		const prevWindows = prevState.windows

		const createWindows = differenceBy(
			nextWindows,
			prevWindows,
			(win) => win.id
		)
		const destroyWindows = differenceBy(
			prevWindows,
			nextWindows,
			(win) => win.id
		)
		const updateWindows = intersectionBy(
			nextWindows,
			prevWindows,
			(win) => win.id
		)

		for (const win of destroyWindows) {
			this.browserWindows[win.id]?.destroy()
			delete this.browserWindows[win.id]
		}
		for (const win of updateWindows) {
			this.updateWindow(win)
		}
		for (const win of createWindows) {
			this.initWindow(win)
		}

		const focused = nextWindows[0]
		if (focused) {
			const browserWindow = this.browserWindows[focused.id]
			if (browserWindow && !browserWindow.isFocused()) {
				browserWindow.focus()
			}
		}
	}

	// Batch together the move updates.
	private rectUpdates: { [id: string]: WindowRect } = {}
	updateRect(id: string, rect: WindowRect) {
		this.rectUpdates[id] = rect
		this.throttledUpdateRects()
	}
	actuallyUpdateRects = () => {
		for (const [id, rect] of Object.entries(this.rectUpdates)) {
			const browserWindow = this.browserWindows[id]
			if (!browserWindow) continue

			const [x, y] = browserWindow.getPosition()
			if (rect.x !== x || rect.y !== y)
				browserWindow.setPosition(rect.x, rect.y, true)

			const [width, height] = browserWindow.getSize()
			if (rect.width !== width || rect.width !== height)
				browserWindow.setSize(rect.width, rect.height, true)
		}
		this.rectUpdates = {}
	}
	throttledUpdateRects = throttle(this.actuallyUpdateRects, 200, {
		leading: false,
	})

	updateWindow(windowState: WindowState) {
		const browserWindow = this.browserWindows[windowState.id]
		if (!browserWindow) {
			return this.initWindow(windowState)
		}

		this.updateRect(windowState.id, windowState.rect)
		return browserWindow
	}

	destroy() {
		for (const browserWindow of Object.values(this.browserWindows)) {
			if (browserWindow) browserWindow.destroy()
		}
	}
}

function createWindow(rect: WindowRect) {
	// Create the browser window.
	const browserWindow = new BrowserWindow({
		...rect,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	})

	// and load the index.html of the app.
	browserWindow.loadFile(path.join(__dirname, "../index.html"))

	// Open the DevTools.
	// mainWindow.webContents.openDevTools()

	return browserWindow
}

// ==================================================================
// SystemMenuPlugin
// ==================================================================

export const SystemMenuPlugin: MainAppPlugin = (mainApp) => {
	return {
		update() {
			const { windows } = mainApp.state

			const items = windows.map((win, i) => {
				return [
					{
						label: "Close Window " + i,
						click() {
							mainApp.dispatch({ type: "close-window", id: win.id })
						},
					},
					{
						label: "Move Window " + i,
						click() {
							mainApp.dispatch({
								type: "move-window",
								id: win.id,
								x: win.rect.x + 20,
								y: win.rect.y,
							})
						},
					},
					{
						label: "Resize Window " + i,
						click() {
							mainApp.dispatch({
								type: "resize-window",
								id: win.id,
								width: win.rect.width + 20,
								height: win.rect.height,
							})
						},
					},
					{
						label: "Focus Window " + i,
						click() {
							mainApp.dispatch({
								type: "focus-window",
								id: win.id,
							})
						},
					},
				]
			})

			const menu = Menu.buildFromTemplate([
				{
					label: app.name,
					submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
				},
				{
					label: "File",
					submenu: [{ role: "close" }],
				},
				{
					label: "Dispatch",
					submenu: [
						{
							label: "New Window",
							click() {
								mainApp.dispatch({ type: "new-window" })
							},
						},
						...flatten(items),
					],
				},
			])
			Menu.setApplicationMenu(menu)
		},
		destroy() {},
	}
}
