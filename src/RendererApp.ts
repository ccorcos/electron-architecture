import {
	RendererApp,
	RendererAppAction,
	RendererAppPlugin,
	RendererAppState,
} from "./state"
import { answerMain, callMain } from "./RendererIPC"

// ==================================================================
// State
// ==================================================================

type WindowRect = {
	x: number
	y: number
	width: number
	height: number
}

declare module "./state" {
	interface RendererAppState {
		rect: WindowRect
	}
}

// ==================================================================
// Action
// ==================================================================

type MoveWindowAction = {
	type: "move-window"
	x: number
	y: number
}

type ResizeWindowAction = {
	type: "resize-window"
	width: number
	height: number
}

declare module "./state" {
	interface RendererAppActions {
		moveWindowAction: MoveWindowAction
		resizeWindowAction: ResizeWindowAction
	}
}

// ==================================================================
// Reducers
// ==================================================================

function moveWindow(
	state: RendererAppState,
	action: MoveWindowAction
): RendererAppState {
	const { rect } = state
	const { x, y } = action
	return {
		rect: { ...rect, x, y },
	}
}

function resizeWindow(
	state: RendererAppState,
	action: ResizeWindowAction
): RendererAppState {
	const { rect } = state
	const { height, width } = action
	return {
		rect: { ...rect, height, width },
	}
}

export function updateRendererState(
	state: RendererAppState,
	action: RendererAppAction
): RendererAppState {
	switch (action.type) {
		case "move-window":
			return moveWindow(state, action)
		case "resize-window":
			return resizeWindow(state, action)
	}
}

// ==================================================================
// WindowRectPlugin
// ==================================================================

export const WindowRectPlugin: RendererAppPlugin = (app) => {
	return new WindowRectController(app)
}

declare module "./IPC" {
	interface RendererToMainIPC {
		setPosition(args: { x: number; y: number }): void
		setSize(args: { height: number; width: number }): void
	}

	interface MainToRendererIPC {
		updatePosition(args: { x: number; y: number }): void
		updateSize(args: { height: number; width: number }): void
	}
}

class WindowRectController {
	private listeners: (() => void)[] = []

	constructor(private app: RendererApp) {
		this.listeners.push(
			answerMain("updatePosition", ({ x, y }) => {
				app.dispatch({ type: "move-window", x, y })
			})
		)
		this.listeners.push(
			answerMain("updateSize", ({ height, width }) => {
				app.dispatch({ type: "resize-window", height, width })
			})
		)
	}

	update(prevState: RendererAppState) {
		const nextState = this.app.state
		if (nextState === prevState) return
		if (nextState.rect === prevState.rect) return

		const nextRect = nextState.rect
		const prevRect = prevState.rect

		if (nextRect.x !== prevRect.x || nextRect.y !== prevRect.y) {
			callMain("setPosition", nextRect)
		}

		if (
			nextRect.width !== prevRect.width ||
			nextRect.height !== prevRect.height
		) {
			callMain("setSize", nextRect)
		}
	}

	destroy() {
		this.listeners.forEach((fn) => fn())
	}
}

export const WindowRectViewPlugin: RendererAppPlugin = (app) => {
	return new WindowRectViewController(app)
}

class WindowRectViewController {
	details: HTMLDivElement
	button: HTMLButtonElement

	constructor(private app: RendererApp) {
		this.details = document.createElement("div")
		this.details.innerText = JSON.stringify(app.state, null, 2)
		document.body.appendChild(this.details)

		this.button = document.createElement("button")
		this.button.innerText = "Move"
		document.body.appendChild(this.button)
		this.button.addEventListener("click", () => {
			const { x, y } = app.state.rect
			app.dispatch({ type: "move-window", x: x + 20, y })
		})
	}
	update() {
		this.details.innerText = JSON.stringify(this.app.state, null, 2)
	}
	destroy() {}
}
