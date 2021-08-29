import {
	Actions,
	Dispatcher,
	EffectPlugin,
	StateMachine,
} from "../StateMachine"
import { RendererState } from "./RendererState"

function moveWindow(
	state: RendererState,
	action: { x: number; y: number }
): RendererState {
	const { rect } = state
	const { x, y } = action
	return {
		rect: { ...rect, x, y },
	}
}

function resizeWindow(
	state: RendererState,
	action: { width: number; height: number }
): RendererState {
	const { rect } = state
	const { height, width } = action
	return {
		rect: { ...rect, height, width },
	}
}

const rendererReducers = {
	moveWindow,
	resizeWindow,
}

export type RendererAction = Actions<typeof rendererReducers>
export type RendererDispatch = Dispatcher<typeof rendererReducers>

export type RendererAppPlugin = EffectPlugin<
	RendererState,
	typeof rendererReducers
>

export class RendererApp extends StateMachine<
	RendererState,
	typeof rendererReducers
> {
	constructor(initialState: RendererState, plugins: RendererAppPlugin[] = []) {
		super(initialState, rendererReducers, plugins)
	}
}
