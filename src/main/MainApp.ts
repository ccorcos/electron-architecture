import { EffectPlugin, StateMachine } from "../StateMachine"
import { randomId } from "../utils"
import { initMain, initRect, MainState, WindowState } from "./MainState"

function newWindow(state: MainState): MainState {
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
			: initRect(),
	}
	return {
		...state,
		windows: [window, ...windows],
	}
}

function closeWindow(state: MainState, id: string): MainState {
	const { windows } = state

	return {
		...state,
		windows: windows.filter((win) => win.id !== id),
	}
}

function moveWindow(
	state: MainState,
	id: string,
	point: {
		x: number
		y: number
	}
): MainState {
	const { windows } = state
	const { x, y } = point
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
	state: MainState,
	id: string,
	size: { width: number; height: number }
): MainState {
	const { windows } = state
	const { width, height } = size
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

function focusWindow(state: MainState, id: string): MainState {
	const { windows } = state
	const [focused] = windows

	if (focused.id === id) return state

	const newFocused = windows.find((win) => win.id === id)
	if (!newFocused) return state

	const newOthers = windows.filter((win) => win.id !== id)
	return {
		...state,
		windows: [newFocused, ...newOthers],
	}
}

const mainReducers = {
	newWindow,
	closeWindow,
	moveWindow,
	resizeWindow,
	focusWindow,
}

export type MainAppPlugin = EffectPlugin<MainState, typeof mainReducers>

export class MainApp extends StateMachine<MainState, typeof mainReducers> {
	constructor(plugins: MainAppPlugin[]) {
		super(initMain(), mainReducers, plugins)
	}
}
