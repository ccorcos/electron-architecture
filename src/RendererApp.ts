import { answerMain, callMain } from "./RendererIPC"
import { App, Plugin } from "./state"

// ==================================================================
// State
// ==================================================================

type WindowRect = {
	x: number
	y: number
	width: number
	height: number
}

type RendererState = {
	rect: WindowRect
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

type RendererAction = MoveWindowAction | ResizeWindowAction

// ==================================================================
// Reducers
// ==================================================================

function moveWindowReducer(
	state: RendererState,
	action: MoveWindowAction
): RendererState {
	const { rect } = state
	const { x, y } = action
	return {
		rect: { ...rect, x, y },
	}
}

function resizeWindowReducer(
	state: RendererState,
	action: ResizeWindowAction
): RendererState {
	const { rect } = state
	const { height, width } = action
	return {
		rect: { ...rect, height, width },
	}
}

export function rendererReducer(
	state: RendererState,
	action: RendererAction
): RendererState {
	switch (action.type) {
		case "move-window":
			return moveWindowReducer(state, action)
		case "resize-window":
			return resizeWindowReducer(state, action)
	}
}

// ==================================================================
// App
// ==================================================================

export type RendererAppPlugin = Plugin<RendererState, RendererAction>

export class RendererApp extends App<RendererState, RendererAction> {
	constructor(initialState: RendererState, plugins: RendererAppPlugin[]) {
		super(initialState, rendererReducer, plugins)
	}
}

// ==================================================================
// WindowRectPlugin
// ==================================================================

export const SyncWindowRectPlugin: RendererAppPlugin = (app) => {
	return new SyncWindowRectController(app)
}

class SyncWindowRectController {
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

	update(prevState: RendererState) {
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

export const DisplayWindowRectPlugin: RendererAppPlugin = (app) => {
	return new DisplayWindowRectController(app)
}

class DisplayWindowRectController {
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

	destroy() {
		document.body.removeChild(this.details)
		document.body.removeChild(this.button)
	}
}
