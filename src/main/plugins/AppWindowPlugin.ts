/*

This "plugin" manages the app windows. The annoying part here is that it is no declarative.
Ideally, we'd have some kind of "virtual browser window" API similar to React to doing all
of the updates. But for now, this is what we're working with.

*/

import { BrowserWindow } from "electron"
import { differenceBy, intersectionBy } from "lodash"
import * as path from "path"
import { MainApp, MainAppPlugin } from "../MainApp"
import { answerRenderer, callRenderer } from "../MainIPC"
import { MainState, WindowState } from "../MainState"

export const AppWindowPlugin: MainAppPlugin = (app) => {
	return new AppWindowController(app)
}

type AppWindowState = WindowState & { focused: boolean }

class AppWindow {
	private browserWindow: BrowserWindow

	constructor(private mainApp: MainApp, private windowState: AppWindowState) {
		const { id, rect } = windowState
		this.browserWindow = new BrowserWindow({
			show: false,
			...rect,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				preload: path.join(__dirname, "../renderer/preload.js"),
			},
		})
		this.browserWindow.loadFile(path.join(__dirname, "../renderer/index.html"))

		if (windowState.focused) {
			this.browserWindow.show()
		} else {
			this.browserWindow.showInactive()
		}

		this.browserWindow.on("close", () => mainApp.dispatch.closeWindow(id))

		this.browserWindow.on("move", () => {
			const [x, y] = this.browserWindow.getPosition()
			const { rect } = this.windowState
			if (rect.x === x && rect.y === y) return
			mainApp.dispatch.moveWindow(id, { x, y })
		})

		this.browserWindow.on("resize", () => {
			const [width, height] = this.browserWindow.getSize()
			const { rect } = this.windowState
			if (rect.width === width && rect.height === height) return
			mainApp.dispatch.resizeWindow(id, { width, height })
		})

		this.browserWindow.on("focus", () => {
			if (!this.windowState.focused) {
				mainApp.dispatch.focusWindow(id)
			}
		})

		answerRenderer.load(this.browserWindow, () => this.windowState.rect)

		answerRenderer.setPosition(this.browserWindow, ({ x, y }) => {
			const { rect } = this.windowState
			if (rect.x === x && rect.y === y) return
			mainApp.dispatch.moveWindow(id, { x, y })
		})

		answerRenderer.setSize(this.browserWindow, ({ width, height }) => {
			const { rect } = this.windowState
			if (rect.width === width && rect.height === height) return
			mainApp.dispatch.resizeWindow(id, { width, height })
		})
	}

	updateState(nextState: AppWindowState) {
		const prevState = this.windowState
		if (prevState === nextState) return
		this.windowState = nextState

		if (prevState.id !== nextState.id)
			throw new Error("Window id should not change.")

		if (nextState.focused && !this.browserWindow.isFocused()) {
			this.browserWindow.focus()
		}

		if (prevState.rect === nextState.rect) return

		const prevRect = prevState.rect
		const nextRect = nextState.rect

		if (prevRect.x !== nextRect.x || prevRect.y !== nextRect.y) {
			this.browserWindow.setPosition(nextRect.x, nextRect.y, false)
			callRenderer.updatePosition(this.browserWindow, nextRect)
		}

		if (
			prevRect.height !== nextRect.height ||
			prevRect.width !== nextRect.width
		) {
			this.browserWindow.setSize(nextRect.width, nextRect.height, false)
			callRenderer.updateSize(this.browserWindow, nextRect)
		}
	}

	destroy() {
		this.browserWindow.destroy()
	}
}

class AppWindowController {
	private appWindows: { [id: string]: AppWindow } = {}

	constructor(private mainApp: MainApp) {
		mainApp.state.windows.forEach((win, i) => {
			this.appWindows[win.id] = new AppWindow(mainApp, {
				...win,
				focused: i === 0,
			})
		})
	}

	update(prevState: MainState) {
		const nextState = this.mainApp.state
		const createWindows = differenceBy(
			nextState.windows,
			prevState.windows,
			(win) => win.id
		)
		const destroyWindows = differenceBy(
			prevState.windows,
			nextState.windows,
			(win) => win.id
		)
		// Note: this returns values only from the first array.
		const updateWindows = intersectionBy(
			nextState.windows,
			prevState.windows,
			(win) => win.id
		)

		const focusedId = nextState.windows[0]?.id

		for (const oldProps of destroyWindows) {
			this.appWindows[oldProps.id].destroy()
			delete this.appWindows[oldProps.id]
		}
		for (const nextProps of updateWindows) {
			this.appWindows[nextProps.id].updateState({
				...nextProps,
				focused: focusedId === nextProps.id,
			})
		}
		for (const props of createWindows) {
			this.appWindows[props.id] = new AppWindow(this.mainApp, {
				...props,
				focused: focusedId === props.id,
			})
		}
	}

	destroy() {
		Object.values(this.appWindows).forEach((win) => win.destroy())
	}
}
