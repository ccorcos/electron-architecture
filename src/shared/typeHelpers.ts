export type Assert<Actual extends Expected, Expected> = {}

export function isDefined<T>(obj: T | undefined): obj is T {
	if (obj === undefined) {
		return false
	} else {
		return true
	}
}

export function isTruthy<T>(obj: T | undefined | null | false): obj is T {
	if (obj === undefined || obj === null || obj === false) {
		return false
	} else {
		return true
	}
}

export type AnyFunction = (...args: any[]) => any

export type Asyncify<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? F
	: (...args: Parameters<F>) => Promise<ReturnType<F>>

export type Syncify<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? (...args: Parameters<F>) => Awaited<ReturnType<F>>
	: F

export type AsyncApi<Api extends Record<string, AnyFunction>> = {
	[key in keyof Api]: Asyncify<Api[key]>
}

export type TupleRest<T extends unknown[]> = T extends [any, ...infer U]
	? U
	: never

export type AnyFunctionMap = { [key: string]: AnyFunction }

export type Caller<T extends AnyFunctionMap> = {
	[K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<Asyncify<T[K]>>
}

export type Answerer<T extends AnyFunctionMap> = {
	[K in keyof T]: (fn: Syncify<T[K]> | Asyncify<T[K]>) => () => void
}

export type Rect = { left: number; top: number; width: number; height: number }
export type Point = { x: number; y: number }
export type PointDelta = { x?: number; y?: number }

export type Range = { from: number; to: number }

export type PopupApi<Args> = {
	render(args: Args): void
	destroy(): void
}
