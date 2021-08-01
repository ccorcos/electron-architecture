/*

Goals:
- state should be immutable and data-only.
- view should be the container for the state/dispatch loop
- plugins should implement the effects.

In ProseMirror, State has plugins as well... and plugins can have their own State that can be controlled from elsewhere.

StatePlugin: whenever I focus another window, re-position the underlying windows.
PluginState: this is really just global state that's namespaced.


*/

import { BrowserWindow, app, Menu } from "electron"
import { differenceBy, flatten, intersectionBy } from "lodash"

export type MainSchema = {
	windows: WindowSchema[]
}

export type WindowRect = {
	x: number
	y: number
	width: number
	height: number
}

export type WindowSchema = {
	id: string
	rect: WindowRect
}

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

export type MainAction =
	| NewWindowAction
	| CloseWindowAction
	| MoveWindowAction
	| ResizeWindowAction
	| FocusWindowAction

export type State<S, A> = {
	init: () => S
	update: (state: S, action: A) => S
}

export type App<S, A> = {
	state: S
	dispatch(action: A): void
}

export type EffectPlugin<S, A> = (view: App<S, A>) => Effect<S>

export type Effect<S> = {
	update(prevState: S): void
	destroy(): void
}

export function initMainState(): MainSchema {
	const windowState = {
		id: randomId(),
		rect: initialRect(),
	}
	return {
		windows: [windowState],
	}
}

export function updateMainState(
	state: MainSchema,
	action: MainAction
): MainSchema {
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

function newWindow(state: MainSchema, action: NewWindowAction): MainSchema {
	const { windows } = state
	const [focused, ...others] = windows
	const window: WindowSchema = {
		id: randomId(),
		rect: {
			x: focused.rect.x + 20,
			y: focused.rect.y + 20,
			width: focused.rect.width,
			height: focused.rect.height,
		},
	}
	return {
		...state,
		windows: [window, focused, ...others],
	}
}

function closeWindow(state: MainSchema, action: CloseWindowAction): MainSchema {
	const { windows } = state
	const { id } = action

	return {
		...state,
		windows: windows.filter((win) => win.id !== id),
	}
}

function moveWindow(state: MainSchema, action: MoveWindowAction): MainSchema {
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
	state: MainSchema,
	action: ResizeWindowAction
): MainSchema {
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

function focusWindow(state: MainSchema, action: FocusWindowAction): MainSchema {
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

export class MainApp implements App<MainSchema, MainAction> {
	private effects: Effect<MainSchema>[]
	constructor(
		public state: MainSchema,
		plugins: EffectPlugin<MainSchema, MainAction>[]
	) {
		this.effects = plugins.map((plugin) => plugin(this))
	}

	dispatch(action: MainAction) {
		const prevState = this.state
		this.state = updateMainState(prevState, action)
		for (const effect of this.effects) {
			effect.update(prevState)
		}
	}

	destroy() {
		for (const effect of this.effects) {
			effect.destroy()
		}
	}
}

export const ElectronWindowPlugin: EffectPlugin<MainSchema, MainAction> = (
	app
) => {
	return new ElectronWindowManager(app)
}

class ElectronWindowManager {
	private browserWindows: { [id: string]: BrowserWindow | undefined } = {}

	constructor(private app: App<MainSchema, MainAction>) {
		const { windows } = app.state
		const focused = windows[0]
		const reversed = [...windows].reverse()
		for (const windowState of reversed) {
			const browserWindow = this.initWindow(windowState)
			if (windowState === focused) browserWindow.focus()
		}
	}

	private initWindow(windowState: WindowSchema) {
		const browserWindow = createWindow(windowState.rect)
		this.browserWindows[windowState.id] = browserWindow

		browserWindow.on("close", () => {
			this.app.dispatch({ type: "close-window", id: windowState.id })
		})
		browserWindow.on("move", () => {
			const [x, y] = browserWindow.getPosition()
			this.app.dispatch({ type: "move-window", id: windowState.id, x, y })
		})
		browserWindow.on("resize", () => {
			const [width, height] = browserWindow.getSize()
			this.app.dispatch({
				type: "resize-window",
				id: windowState.id,
				width,
				height,
			})
		})
		browserWindow.on("focus", () => {
			this.app.dispatch({ type: "focus-window", id: windowState.id })
		})

		return browserWindow
	}

	update(prevState: MainSchema) {
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

	updateWindow(windowState: WindowSchema) {
		const browserWindow = this.browserWindows[windowState.id]
		if (!browserWindow) {
			return this.initWindow(windowState)
		}
		const { rect } = windowState

		const [x, y] = browserWindow.getPosition()
		if (rect.x !== x || rect.y !== y) browserWindow.setPosition(rect.x, rect.y)

		const [width, height] = browserWindow.getSize()
		if (rect.width !== width || rect.width !== height)
			browserWindow.setSize(rect.width, rect.height, false)

		return browserWindow
	}

	destroy() {
		for (const browserWindow of Object.values(this.browserWindows)) {
			if (browserWindow) browserWindow.destroy()
		}
	}
}

import * as path from "path"

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

export const SystemMenuPlugin: EffectPlugin<MainSchema, MainAction> = (
	mainApp
) => {
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
