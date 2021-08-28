import { randomId } from "../utils"

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

export function initRect() {
	return {
		height: 600,
		width: 800,
		x: 200,
		y: 200,
	}
}

export function initMain(): MainState {
	const windowState = { id: randomId(), rect: initRect() }
	return { windows: [windowState] }
}
