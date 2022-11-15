import { DeferredPromise } from "../../shared/DeferredPromise"
import { StateMachine } from "../../shared/StateMachine"
import { TestHarnessIpc, TestHarnessSocketApi } from "./TestHarness"
import type {
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
> {}

export class MainHarnessConnection extends TestHarnessIpc<
	HarnessToMain,
	MainToHarness
> {}

type HarnessTestState = {
	main: MainHarnessConnection | undefined
	renderers: RendererHarnessConnection[]
}

type HarnessServerState = {
	[testId: string]: HarnessTestState | undefined
}

function connectMain(
	state: HarnessServerState,
	testId: string,
	harness: MainHarnessConnection
): HarnessServerState {
	const testState = state[testId]
	if (!testState) {
		console.error(new Error(`Test ${testId} was undefined`))
		return state
	}

	if (testState.main) {
		console.error(new Error("Already a main connection."))
		return state
	}
	return {
		...state,
		[testId]: { ...testState, main: harness },
	}
}

function disconnectMain(
	state: HarnessServerState,
	testId: string
): HarnessServerState {
	const testState = state[testId]
	if (!testState) {
		console.error(new Error(`Test ${testId} was undefined`))
		return state
	}

	return {
		...state,
		[testId]: { ...testState, main: undefined },
	}
}

function connectRenderer(
	state: HarnessServerState,
	testId: string,
	harness: RendererHarnessConnection
): HarnessServerState {
	const testState = state[testId]
	if (!testState) {
		console.error(new Error(`Test ${testId} was undefined`))
		return state
	}

	if (testState.renderers.includes(harness)) {
		return state
	}

	return {
		...state,
		[testId]: {
			...testState,
			renderers: [...testState.renderers, harness],
		},
	}
}

function disconnectRenderer(
	state: HarnessServerState,
	testId: string,
	harness: RendererHarnessConnection
): HarnessServerState {
	const testState = state[testId]
	if (!testState) {
		console.error(new Error(`Test ${testId} was undefined`))
		return state
	}

	const { renderers } = testState

	if (renderers.includes(harness)) {
		return {
			...state,
			[testId]: {
				...testState,
				renderers: renderers.filter((x) => x !== harness),
			},
		}
	} else {
		return state
	}
}

function mountTest(
	state: HarnessServerState,
	testId: string
): HarnessServerState {
	return {
		...state,
		[testId]: {
			main: undefined,
			renderers: [],
		},
	}
}

function unmountTest(state: HarnessServerState, testId: string) {
	const newState = { ...state }
	delete newState[testId]
	return newState
}

const harnessReducers = {
	connectMain,
	disconnectMain,
	connectRenderer,
	disconnectRenderer,
	mountTest,
	unmountTest,
}

/**
 * A testing harness that connects to running main and renderer processes
 * and enables testing by sending them events via ipc.
 */
export class TestHarnessServer extends StateMachine<
	HarnessServerState,
	typeof harnessReducers
> {
	private destructors: { destroy: () => Promise<void> }[] = []

	constructor() {
		super({}, harnessReducers)
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

	async waitUntil(fn: (state: HarnessServerState) => boolean) {
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

	async waitUntilTestIsReady(testId: string) {
		await this.waitUntil((state) => {
			const mainIsReady = Boolean(state[testId]?.main)
			const rendererIsReady = (state[testId]?.renderers.length || 0) > 0

			return mainIsReady && rendererIsReady
		})

		return {
			main: this.state[testId]!.main!,
			renderers: this.state[testId]!.renderers!,
		}
	}

	async destroy() {
		for (const destructor of this.destructors) {
			await destructor.destroy()
		}
	}

	handleMainConnection = (socket: TestHarnessSocketApi) => {
		const main = new MainHarnessConnection(socket)

		main.answer.ready((testId) => {
			// console.log(`main for test ${testId} ready!`)
			this.dispatch.connectMain(testId, main)

			socket.onClose(() => {
				this.dispatch.disconnectMain(testId)
			})
		})
	}

	handleRendererConnection = (socket: TestHarnessSocketApi) => {
		const renderer = new RendererHarnessConnection(socket)

		renderer.answer.ready((testId) => {
			// console.log(`renderer for test ${testId} ready!`)
			this.dispatch.connectRenderer(testId, renderer)

			socket.onClose(() => {
				this.dispatch.disconnectRenderer(testId, renderer)
			})
		})
	}

	static async create(MAIN_PORT: number, RENDERER_PORT: number) {
		const harness = new TestHarnessServer()

		const servers = await Promise.all([
			listenForTestHarnessTcpSockets(MAIN_PORT, (socket) =>
				harness.handleMainConnection(socket)
			),
			listenForTestHarnessWebSockets(RENDERER_PORT, (socket) => {
				harness.handleRendererConnection(socket)
			}),
		])

		// console.log(
		// 	`Testing harness is ready; listening for main connections on ${MAIN_PORT} and renderer connections on ${RENDERER_PORT}`
		// )

		harness.destructors.push(...servers)

		return harness
	}
}
