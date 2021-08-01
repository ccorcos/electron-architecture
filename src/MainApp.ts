/*

Goals:
- state should be immutable and data-only.
- app should be the container for the state/dispatch loop.
- plugins should implement and manage the side-effects.

*/

import { BrowserWindow, app, Menu } from "electron"
import { differenceBy, flatten, intersectionBy, throttle } from "lodash"
import * as path from "path"
import { answerRenderer, callRenderer } from "./MainIPC"
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
// ElectronWindowPlugin
// ==================================================================

export const ElectronWindowPlugin: MainAppPlugin = (app) => {
	return new ElectronWindowManager(app)
}

declare module "./IPC" {
	interface RendererToMainIPC {
		load(): WindowRect
	}
}

class AppWindow {
	private browserWindow: BrowserWindow
	private listeners: (() => void)[] = []

	constructor(private app: MainApp, private state: WindowState) {
		const { id } = state

		const browserWindow = createWindow(state.rect)
		this.browserWindow = browserWindow

		browserWindow.on("close", () => {
			this.app.dispatch({ type: "close-window", id })
		})
		browserWindow.on("moved", this.handleMoved)
		browserWindow.on("resized", this.handleResized)
		browserWindow.on("focus", this.handleFocus)

		this.listeners.push(
			answerRenderer(browserWindow, "load", () => this.state.rect)
		)
		this.listeners.push(
			answerRenderer(browserWindow, "setPosition", this.handleSetPosition)
		)
		this.listeners.push(
			answerRenderer(browserWindow, "setSize", this.handleSetSize)
		)
	}

	private handleMoved = () => {
		const [x, y] = this.browserWindow.getPosition()
		this.handleSetPosition({ x, y })
	}

	private handleSetPosition = ({ x, y }: { x: number; y: number }) => {
		const { id } = this.state
		if (this.state.rect.x !== x || this.state.rect.y !== y) {
			this.app.dispatch({ type: "move-window", id, x, y })
		}
	}

	private handleResized = () => {
		const [width, height] = this.browserWindow.getSize()
		this.handleSetSize({ height, width })
	}

	private handleSetSize = ({
		height,
		width,
	}: {
		height: number
		width: number
	}) => {
		const { id } = this.state
		if (this.state.rect.height !== height || this.state.rect.width !== width) {
			this.app.dispatch({
				type: "resize-window",
				id,
				width,
				height,
			})
		}
	}

	private handleFocus = () => {
		const { id } = this.state
		if (this.app.state.windows[0]?.id !== id) {
			this.app.dispatch({ type: "focus-window", id })
		}
	}

	public focus() {
		if (!this.browserWindow.isFocused()) {
			this.browserWindow.focus()
		}
	}

	public destroy() {
		this.listeners.forEach((fn) => fn())
		this.browserWindow.destroy()
	}

	public update(state: WindowState) {
		// TODO: this is confusing how this is not prevState...
		this.state = state
		const { rect } = state

		const [x, y] = this.browserWindow.getPosition()
		if (rect.x !== x || rect.y !== y) {
			this.browserWindow.setPosition(rect.x, rect.y, false)
		}

		const [width, height] = this.browserWindow.getSize()
		if (rect.width !== width || rect.width !== height) {
			this.browserWindow.setSize(rect.width, rect.height, false)
		}

		callRenderer(this.browserWindow, "updateSize", rect)
		callRenderer(this.browserWindow, "updatePosition", rect)
	}
}

class ElectronWindowManager {
	private appWindows: { [id: string]: AppWindow | undefined } = {}

	constructor(private app: MainApp) {
		const { windows } = app.state
		const focused = windows[0]
		const reversed = [...windows].reverse()
		for (const windowState of reversed) {
			const appWindow = this.initWindow(windowState)
			if (windowState === focused) appWindow.focus()
		}
	}

	private initWindow(windowState: WindowState) {
		const appWindow = new AppWindow(this.app, windowState)
		this.appWindows[windowState.id] = appWindow
		return appWindow
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
			this.appWindows[win.id]?.destroy()
			delete this.appWindows[win.id]
		}
		for (const win of updateWindows) {
			this.appWindows[win.id]?.update(win)
		}
		for (const win of createWindows) {
			this.initWindow(win)
		}

		const focused = nextWindows[0]
		if (focused) {
			this.appWindows[focused.id]?.focus()
		}
	}

	destroy() {
		for (const appWindow of Object.values(this.appWindows)) {
			if (appWindow) appWindow.destroy()
		}
	}
}

function createWindow(rect: WindowRect) {
	// Create the browser window.
	const browserWindow = new BrowserWindow({
		...rect,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			preload: path.join(__dirname, "preload.js"),
		},
	})

	// and load the index.html of the app.
	browserWindow.loadFile(path.join(__dirname, "../index.html"))

	// Open the DevTools.
	browserWindow.webContents.openDevTools()

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
