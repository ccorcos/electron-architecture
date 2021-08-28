/*

We'll model the main process state as a state machine, similar to Redux.

*/

import { randomId } from "../utils"

// ==================================================================
// State
// ==================================================================

export type WindowRect = {
	x: number
	y: number
	width: number
	height: number
}

export type WindowState = {
	id: string
	rect: WindowRect
}

export type MainState = {
	windows: WindowState[]
}

// ==================================================================
// Action
// ==================================================================

// We want action creators so we can do reverse lookup!

export type NewWindowAction = { type: "newWindow" }

export type CloseWindowAction = { type: "closeWindow"; id: string }

export type MoveWindowAction = {
	type: "moveWindow"
	id: string
	x: number
	y: number
}

export type ResizeWindowAction = {
	type: "resizeWindow"
	id: string
	width: number
	height: number
}

export type FocusWindowAction = { type: "focusWindow"; id: string }

export type MainAction =
	| NewWindowAction
	| CloseWindowAction
	| MoveWindowAction
	| ResizeWindowAction
	| FocusWindowAction

// ==================================================================
// Reducer
// ==================================================================

function newWindowReducer(
	state: MainState,
	action: NewWindowAction
): MainState {
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

function closeWindowReducer(
	state: MainState,
	action: CloseWindowAction
): MainState {
	const { windows } = state
	const { id } = action

	return {
		...state,
		windows: windows.filter((win) => win.id !== id),
	}
}

function moveWindowReducer(
	state: MainState,
	action: MoveWindowAction
): MainState {
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

function resizeWindowReducer(
	state: MainState,
	action: ResizeWindowAction
): MainState {
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

function focusWindowReducer(
	state: MainState,
	action: FocusWindowAction
): MainState {
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

function initRect() {
	return {
		height: 600,
		width: 800,
		x: 200,
		y: 200,
	}
}

export function mainInit(): MainState {
	const windowState = { id: randomId(), rect: initRect() }
	return { windows: [windowState] }
}

export function mainReducer(state: MainState, action: MainAction): MainState {
	switch (action.type) {
		case "newWindow":
			return newWindowReducer(state, action)
		case "closeWindow":
			return closeWindowReducer(state, action)
		case "moveWindow":
			return moveWindowReducer(state, action)
		case "resizeWindow":
			return resizeWindowReducer(state, action)
		case "focusWindow":
			return focusWindowReducer(state, action)
	}
}
