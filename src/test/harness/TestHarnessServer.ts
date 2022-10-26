import { MainEnvironment } from "../../app/main/MainEnvironment"
import { Environment } from "../../app/renderer/Environment"
import { StateMachine } from "../../app/shared/StateMachine"
import { DeferredPromise } from "../../app/shared/utils/DeferredPromise"
import { MAIN_PORT, RENDERER_PORT, TestHarnessIpc } from "./TestHarness"
import {
	HarnessToMain,
	HarnessToRenderer,
	MainToHarness,
	RendererToHarness,
} from "./TestHarnessApi"
import { listenForTestHarnessTcpSockets } from "./TestHarnessTcpSocketServer"
import { listenForTestHarnessWebSockets } from "./TestHarnessWebSocketServer"

export class RendererHarnessConnection extends TestHarnessIpc<
	HarnessToRenderer,
	RendererToHarness
> {
	async eval<P extends any[], R>(
		fn: (
			context: { window: Window; environment: Environment },
			...args: P
		) => R,
		...args: P
	): Promise<R> {
		const result = await this.call.eval(fn.toString(), args)
		return result as R
	}
}

export class MainHarnessConnection extends TestHarnessIpc<
	HarnessToMain,
	MainToHarness
> {
	async eval<P extends any[], R>(
		fn: (environment: MainEnvironment, ...args: P) => R,
		...args: P
	): Promise<R> {
		const result = await this.call.eval(fn.toString(), args)
		return result as R
	}
}

type HarnessState = {
	pendingMain: MainHarnessConnection | undefined
	main: MainHarnessConnection | undefined
	pendingRenderers: RendererHarnessConnection[]
	renderers: RendererHarnessConnection[]
}

function connectMain(
	state: HarnessState,
	harness: MainHarnessConnection
): HarnessState {
	if (state.main || state.pendingMain) {
		console.error(new Error("Already a main connection."))
		return state
	}
	return { ...state, pendingMain: harness }
}

function disconnectMain(state: HarnessState): HarnessState {
	if (state.pendingMain) {
		return { ...state, pendingMain: undefined }
	} else {
		return { ...state, main: undefined }
	}
}

function connectRenderer(
	state: HarnessState,
	harness: RendererHarnessConnection
): HarnessState {
	return {
		...state,
		pendingRenderers: [...state.pendingRenderers, harness],
	}
}

function disconnectRenderer(
	state: HarnessState,
	harness: RendererHarnessConnection
): HarnessState {
	if (state.pendingRenderers.includes(harness)) {
		return {
			...state,
			pendingRenderers: state.pendingRenderers.filter((x) => x !== harness),
		}
	} else if (state.renderers.includes(harness)) {
		return {
			...state,
			renderers: state.renderers.filter((x) => x !== harness),
		}
	} else {
		return state
	}
}

function setMainReady(state: HarnessState): HarnessState {
	const main = state.pendingMain

	return {
		...state,
		pendingMain: undefined,
		main,
	}
}

function setRendererReady(
	state: HarnessState,
	renderer: RendererHarnessConnection
): HarnessState {
	if (
		state.renderers.includes(renderer) ||
		!state.pendingRenderers.includes(renderer)
	) {
		return state
	}

	const newPendingRenderers = state.pendingRenderers.filter(
		(x) => x !== renderer
	)
	const newRenderers = [...state.renderers, renderer]
	return {
		...state,
		pendingRenderers: newPendingRenderers,
		renderers: newRenderers,
	}
}

const harnessReducers = {
	connectMain,
	disconnectMain,
	connectRenderer,
	disconnectRenderer,
	setMainReady,
	setRendererReady,
}

/**
 * A testing harness that connects to running main and renderer processes
 * and enables testing by sending them events via ipc.
 */
export class TestHarnessServer extends StateMachine<
	HarnessState,
	typeof harnessReducers
> {
	constructor(public partition: string) {
		super(
			{
				pendingMain: undefined,
				pendingRenderers: [],
				main: undefined,
				renderers: [],
			},
			harnessReducers
		)
	}

	get main() {
		return this.state.main!
	}

	get renderers() {
		return this.state.renderers
	}

	changedState() {
		return new Promise<void>((resolve) => {
			const stop = this.addListener(() => {
				resolve()
				stop()
			})
		})
	}

	async waitUntil(fn: (state: HarnessState) => boolean) {
		const deferred = new DeferredPromise()

		const check = () => {
			if (fn(this.state)) {
				deferred.resolve()
			}
		}

		const stop = this.addListener(check)
		check()

		await deferred.promise
		stop()
	}

	waitUntilReady() {
		return this.waitUntil((state) => {
			return Boolean(state.main) && state.renderers.length > 0
		})
	}

	async destroy() {}

	static async create(
		parition: string,
		mainPort: number = MAIN_PORT,
		rendererPort: number = RENDERER_PORT
	) {
		const harness = new TestHarnessServer(parition)

		const servers = await Promise.all([
			listenForTestHarnessTcpSockets(mainPort, (socket) => {
				const main = new MainHarnessConnection(socket)
				harness.dispatch.connectMain(main)
				main.answer.ready(() => {
					console.log("MAIN READY")
					harness.dispatch.setMainReady()
				})
				socket.onClose(() => {
					harness.dispatch.disconnectMain()
				})
			}),
			listenForTestHarnessWebSockets(rendererPort, (socket) => {
				const renderer = new RendererHarnessConnection(socket)
				harness.dispatch.connectRenderer(renderer)
				renderer.answer.ready(() => {
					console.log("RENDERER READY")
					harness.dispatch.setRendererReady(renderer)
				})
				socket.onClose(() => {
					harness.dispatch.disconnectRenderer(renderer)
				})
			}),
		])

		harness.destroy = async () => {
			for (const server of servers) {
				await server.destroy()
			}
		}

		return harness
	}
}
