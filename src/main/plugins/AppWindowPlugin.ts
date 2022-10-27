/*

This "plugin" manages the app windows. The annoying part here is that it is no declarative.
Ideally, we'd have some kind of "virtual browser window" API similar to React to doing all
of the updates. But for now, this is what we're working with.

*/
import { BrowserWindow } from "electron"
import { differenceBy, intersectionBy } from "lodash"
import path from "path"
import { MainEnvironment } from "../MainEnvironment"
import { MainIPCPeer } from "../MainIPC"
import { MainState, WindowState } from "../MainState"

export const AppWindowPlugin = (environment: MainEnvironment) => {
	return new AppWindowController({ ...environment })
}

class AppWindow {
	private browserWindow: BrowserWindow
	private ipc: MainIPCPeer

	constructor(
		private environment: MainEnvironment,
		private windowState: WindowState
	) {
		const { id, rect } = windowState
		const { config } = environment

		const headless = config.test && config.headless
		this.browserWindow = new BrowserWindow({
			show: !headless,
			...rect,
			webPreferences: {
				preload: path.join(__dirname, "preload.js"),
			},
		})

		this.ipc = new MainIPCPeer(this.browserWindow)

		this.browserWindow.loadFile(path.join(__dirname, "index.html"))

		this.browserWindow.on("focus", () => {
			setTimeout(() => {
				if (!this.windowState.focused) {
					environment.app.dispatch.focusWindow(id)
				}
			})
		})

		this.browserWindow.on("close", () =>
			environment.app.dispatch.closeWindow(id)
		)

		this.browserWindow.on("move", () => {
			const [x, y] = this.browserWindow.getPosition()
			const { rect } = this.windowState
			if (rect.x === x && rect.y === y) return
			environment.app.dispatch.moveWindow(id, { x, y })
		})

		this.browserWindow.on("resize", () => {
			const [width, height] = this.browserWindow.getSize()
			const { rect } = this.windowState
			if (rect.width === width && rect.height === height) return
			environment.app.dispatch.resizeWindow(id, { width, height })
		})

		this.browserWindow.on("focus", () => {
			if (!this.windowState.focused) {
				environment.app.dispatch.focusWindow(id)
			}
		})

		this.ipc.answer.load(() => ({
			test: this.environment.config.test,
			rect: this.windowState.rect,
		}))

		this.ipc.answer.setPosition(({ x, y }) => {
			const { rect } = this.windowState
			if (rect.x === x && rect.y === y) return
			environment.app.dispatch.moveWindow(id, { x, y })
		})

		this.ipc.answer.setSize(({ width, height }) => {
			const { rect } = this.windowState
			if (rect.width === width && rect.height === height) return
			environment.app.dispatch.resizeWindow(id, { width, height })
		})
	}

	updateState(nextState: WindowState) {
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
			this.ipc.call.updatePosition(nextRect)
		}

		if (
			prevRect.height !== nextRect.height ||
			prevRect.width !== nextRect.width
		) {
			this.browserWindow.setSize(nextRect.width, nextRect.height, false)
			this.ipc.call.updateSize(nextRect)
		}
	}

	destroy() {
		this.browserWindow.destroy()
	}
}

class AppWindowController {
	private appWindows: { [id: string]: AppWindow } = {}

	constructor(private environment: MainEnvironment) {
		for (const win of [...environment.app.state.windows].reverse()) {
			this.appWindows[win.id] = new AppWindow(environment, win)
		}
	}

	update(prevState: MainState) {
		const nextState = this.environment.app.state
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
			this.appWindows[props.id] = new AppWindow(this.environment, {
				...props,
				focused: focusedId === props.id,
			})
		}
	}

	destroy() {
		Object.values(this.appWindows).forEach((win) => win.destroy())
	}
}
