import * as net from "net"
import { deserializeError, serializeError } from "serialize-error"
import { DeferredPromise } from "../shared/DeferredPromise"
import { createProxy } from "../shared/proxyHelpers"
import { Answerer, AnyFunctionMap, Caller } from "../shared/typeHelpers"
import { StateMachine } from "../StateMachine"
import { randomId } from "../utils"

type Rect = { x: number; y: number; width: number; height: number }

type HarnessToRenderer = {
	measureDOM(cssSelector: string): Rect | undefined
}

type RendererToHarness = {}

type HarnessToMain = {}

type MainToHarness = {}

export const MAIN_PORT = 1337
export const RENDERER_PORT = 1338

export type RendererHarness = TestHarnessConnection<
	HarnessToRenderer,
	RendererToHarness
>

export type MainHarness = TestHarnessConnection<HarnessToMain, MainToHarness>

// ============================================================================
// Boilerplate
// ============================================================================

export function connectRendererToTestHarness() {
	return connectToTestHarness<RendererToHarness, HarnessToRenderer>(
		RENDERER_PORT
	)
}

export function connectMainToTestHarness() {
	return connectToTestHarness<MainToHarness, HarnessToMain>(MAIN_PORT)
}

function serializeMessage(json: any): string {
	return JSON.stringify(json) + "\x00"
}

function parseMessages(data: Buffer): any[] {
	return data
		.toString("utf8")
		.split("\x00")
		.filter(Boolean)
		.map((str) => JSON.parse(str))
}

type RequestMessage = { type: "request"; id: string; fn: string; args: any[] }
type ResponseMessage = {
	type: "response"
	id: string
	error?: any
	result?: any
}

type Message = RequestMessage | ResponseMessage

type Listener = (message: Message) => void

class TestHarnessSocket {
	private listeners = new Set<Listener>()

	constructor(private socket: net.Socket) {
		socket.setNoDelay(true)
		socket.on("data", (data) => {
			for (const message of parseMessages(data)) {
				this.listeners.forEach((listener) => {
					listener(message)
				})
			}
		})
	}

	async send(message: Message) {
		return new Promise<void>((resolve, reject) =>
			this.socket.write(serializeMessage(message), (error) => {
				if (error) reject(error)
				else resolve()
			})
		)
	}

	onMessage(listener: Listener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	onClose(fn: () => void) {
		this.socket.on("close", fn)
	}
}

export class TestHarnessConnection<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
> {
	private socket: TestHarnessSocket

	constructor(socket: net.Socket) {
		this.socket = new TestHarnessSocket(socket)
	}

	call = createProxy<Caller<C>>((fn: string, ...args) => {
		const deferred = new DeferredPromise<any>()
		const id = randomId()

		// const ms = Date.now()
		const stop = this.socket.onMessage((message) => {
			if (message.type !== "response") return
			if (message.id !== id) return

			// console.log("response", id, Date.now() - ms)
			if (message.error) {
				deferred.reject(deserializeError(message.error))
			} else {
				deferred.resolve(message.result)
			}
			stop()
		})

		this.socket.send({ type: "request", id, fn, args })

		return deferred.promise
	})

	answer = createProxy<Answerer<A>>((fn, callback) => {
		return this.socket.onMessage(async (message) => {
			if (message.type !== "request") return
			if (message.fn === fn) {
				try {
					const result = await callback(...message.args)
					this.socket.send({
						type: "response",
						id: message.id,
						result: result,
					})
				} catch (error) {
					this.socket.send({
						type: "response",
						id: message.id,
						error: serializeError(error),
					})
				}
			}
		})
	})

	onClose(fn: () => void) {
		this.socket.onClose(fn)
	}
}

export async function connectToTestHarness<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
>(port: number) {
	const socket = new net.Socket()
	await new Promise<void>((resolve) =>
		socket.connect(port, "127.0.0.1", resolve)
	)
	const api = new TestHarnessConnection<C, A>(socket)
	return api
}

export async function listenForTestHarnessConnections<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
>(port: number, fn: (connection: TestHarnessConnection<C, A>) => void) {
	const server = net.createServer(async (socket) => {
		fn(new TestHarnessConnection<C, A>(socket))
	})

	await new Promise<void>((resolve) =>
		server.listen(port, "127.0.0.1", resolve)
	)

	return {
		destroy() {
			server.close()
		},
	}
}

type HarnessState = {
	main: MainHarness | undefined
	renderers: RendererHarness[]
}

function connectMain(
	state: HarnessState,
	connection: TestHarnessConnection<any, any>
) {
	if (state.main) throw new Error("Already a main connection.")
	return { ...state, main: connection }
}

function disconnectMain(
	state: HarnessState,
	connection: TestHarnessConnection<any, any>
) {
	return { ...state, main: undefined }
}

function connectRenderer(
	state: HarnessState,
	connection: TestHarnessConnection<any, any>
) {
	return { ...state, renderers: [...state.renderers, connection] }
}

function disconnectRenderer(
	state: HarnessState,
	connection: TestHarnessConnection<any, any>
) {
	return {
		...state,
		renderers: state.renderers.filter((c) => c !== connection),
	}
}

const harnessReducers = {
	connectMain,
	disconnectMain,
	connectRenderer,
	disconnectRenderer,
}

class HarnessApp extends StateMachine<HarnessState, typeof harnessReducers> {
	constructor() {
		super({ main: undefined, renderers: [] }, harnessReducers, [])
	}
}

// connectMain
// disconnectMain
// connectRenderer
// disconnectRenderer

export class TestHarness extends HarnessApp {
	get main() {
		return this.state.main
	}

	get renderers() {
		return this.state.renderers
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
}

export async function createTestHarness(
	mainPort: number = MAIN_PORT,
	rendererPort: number = RENDERER_PORT
) {
	const harness = new TestHarness()

	const servers = await Promise.all([
		listenForTestHarnessConnections<HarnessToMain, MainToHarness>(
			mainPort,
			(connection) => {
				harness.dispatch.connectMain(connection)
			}
		),
		listenForTestHarnessConnections<HarnessToRenderer, RendererToHarness>(
			rendererPort,
			(connection) => {
				harness.dispatch.connectRenderer(connection)
			}
		),
	])

	harness.destroy = async () => {
		for (const server of servers) {
			server.destroy()
		}
	}

	return harness
}
