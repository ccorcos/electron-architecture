export interface RendererToMainIPC {
	ping(): void
}
export interface MainToRendererIPC {
	pong(): void
}

type AnyFunction = (...args: any[]) => any

export type Async<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? F
	: (...args: Parameters<F>) => Promise<ReturnType<F>>
