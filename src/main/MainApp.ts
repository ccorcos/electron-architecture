import {
	Actions,
	Dispatcher,
	EffectPlugin,
	StateMachine,
} from "../shared/StateMachine"
import { WindowRect } from "../shared/typeHelpers"
import { randomId } from "../shared/utils"
import { initMain, initRect, MainState, WindowState } from "./MainState"

function newWindow(state: MainState): MainState {
	const { windows } = state
	const focused = windows[0]

	const newWindow: WindowState = {
		id: randomId(),
		focused: true,
		rect: focused ? getOffsetRect(focused.rect) : initRect(),
	}

	return {
		...state,
		windows: [newWindow, ...unfocusWindows(windows)],
	}
}

function closeWindow(state: MainState, windowId: string): MainState {
	const { windows } = state

	const newWindows = windows.filter((win) => win.id !== windowId)

	if (newWindows.length > 0 && !newWindows[0].focused) {
		newWindows[0] = { ...newWindows[0], focused: true }
	}

	return { ...state, windows: newWindows }
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
				...win,
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
				...win,
				rect: { ...win.rect, width, height },
			}
		}),
	}
}

function focusWindow(state: MainState, windowId: string): MainState {
	const { windows } = state

	const focusWindow = windows.find((win) => win.id === windowId)
	if (!focusWindow) return state

	const otherWindows = unfocusWindows(
		windows.filter((win) => win.id !== windowId)
	)
	const newWindows = [{ ...focusWindow, focused: true }, ...otherWindows]

	return { ...state, windows: newWindows }
}

function getOffsetRect(rect: WindowRect): WindowRect {
	return {
		x: rect.x + 20,
		y: rect.y + 20,
		width: rect.width,
		height: rect.height,
	}
}

function unfocusWindows(windows: WindowState[]) {
	return windows.map((win) => (win.focused ? { ...win, focused: false } : win))
}

const mainReducers = {
	newWindow,
	closeWindow,
	moveWindow,
	resizeWindow,
	focusWindow,
}

export type MainAction = Actions<typeof mainReducers>
export type MainDispatch = Dispatcher<typeof mainReducers>

export type MainAppPlugin = EffectPlugin<MainState, typeof mainReducers>

export class MainApp extends StateMachine<MainState, typeof mainReducers> {
	constructor() {
		super(initMain(), mainReducers)
	}
}
