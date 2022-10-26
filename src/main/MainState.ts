import { WindowRect } from "../shared/typeHelpers"
import { randomId } from "../utils"

export type WindowState = {
	id: string
	focused: boolean
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
	const windowState = { id: randomId(), rect: initRect(), focused: true }
	return { windows: [windowState] }
}
