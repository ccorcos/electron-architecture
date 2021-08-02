// TODO: don't extends this interface...

import { WindowRect } from "./main/MainState"

export interface RendererToMainIPC {
	load(): WindowRect
	setPosition(args: { x: number; y: number }): void
	setSize(args: { height: number; width: number }): void
}

export interface MainToRendererIPC {
	updatePosition(args: { x: number; y: number }): void
	updateSize(args: { height: number; width: number }): void
}

type AnyFunction = (...args: any[]) => any

export type Async<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? F
	: (...args: Parameters<F>) => Promise<ReturnType<F>>
