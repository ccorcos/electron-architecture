import * as net from "net"
import { deserializeError, serializeError } from "serialize-error"
import { MainAction, MainApp } from "../main/MainApp"
import { RendererAction, RendererApp } from "../renderer/RendererApp"
import { RendererState } from "../renderer/RendererState"
import { DeferredPromise } from "../shared/DeferredPromise"
import { createProxy } from "../shared/proxyHelpers"
import { StateMachine } from "../shared/StateMachine"
import { Answerer, AnyFunctionMap, Caller } from "../shared/typeHelpers"
import { randomId } from "../utils"

type Rect = { x: number; y: number; width: number; height: number }

type HarnessToRenderer = {
	measureDOM(cssSelector: string): Rect | undefined
	getState(): RendererState
}

type RendererToHarness = {
	dispatchAction(action: RendererAction): void
}

type HarnessToMain = {}

type MainToHarness = {
	dispatchAction(action: MainAction): void
}

export const MAIN_PORT = 1337
export const RENDERER_PORT = 1338

// ============================================================================
// Boilerplate
// ============================================================================

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

// This class holds state.
class HarnessSocket {
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

// This class is pure, just DX for types.
export class TestHarnessAPI<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
> {
	constructor(private socket: HarnessSocket) {}

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

async function connectToTestHarnessSocket<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
>(port: number) {
	const socket = new net.Socket()
	await new Promise<void>((resolve) =>
		socket.connect(port, "127.0.0.1", resolve)
	)
	return new HarnessSocket(socket)
}

export type RendererHarnessApi = TestHarnessAPI<
	RendererToHarness,
	HarnessToRenderer
>

export async function connectRendererToTestHarness(): Promise<RendererHarnessApi> {
	const socket = await connectToTestHarnessSocket(RENDERER_PORT)
	return new TestHarnessAPI<RendererToHarness, HarnessToRenderer>(socket)
}

export type MainHarnessApi = TestHarnessAPI<MainToHarness, HarnessToMain>

export async function connectMainToTestHarness(): Promise<MainHarnessApi> {
	const socket = await connectToTestHarnessSocket(MAIN_PORT)
	return new TestHarnessAPI<MainToHarness, HarnessToMain>(socket)
}

// This is run inside the test process.
export async function listenForTestHarnessSockets(
	port: number,
	fn: (socket: HarnessSocket) => void
) {
	const server = net.createServer(async (socket) => {
		const harnessSocket = new HarnessSocket(socket)
		fn(harnessSocket)
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

// This class is pure, just DX for types.
export class RendererHarness extends TestHarnessAPI<
	HarnessToRenderer,
	RendererToHarness
> {
	constructor(socket: HarnessSocket, private app: RendererApp) {
		super(socket)
	}

	get state() {
		return this.app.state
	}

	changedState() {
		return new Promise<void>((resolve) => {
			const stop = this.app.addListener(() => {
				resolve()
				stop()
			})
		})
	}

	static async create(socket: HarnessSocket) {
		const renderer = new TestHarnessAPI<HarnessToRenderer, RendererToHarness>(
			socket
		)
		const initialState = await renderer.call.getState()
		const app = new RendererApp(initialState)
		const harness = new RendererHarness(socket, app)
		harness.answer.dispatchAction((action) => app.dispatchAction(action))
		return harness
	}
}

export class MainHarness extends TestHarnessAPI<HarnessToMain, MainToHarness> {
	constructor(socket: HarnessSocket, private app: MainApp) {
		super(socket)
	}

	get state() {
		return this.app.state
	}

	changedState() {
		return new Promise<void>((resolve) => {
			const stop = this.app.addListener(() => {
				resolve()
				stop()
			})
		})
	}

	static create(socket: HarnessSocket) {
		const app = new MainApp()
		const harness = new MainHarness(socket, app)
		harness.answer.dispatchAction((action) => app.dispatchAction(action))
		return harness
	}
}

type HarnessState = {
	main: MainHarness | undefined
	renderers: RendererHarness[]
}

function connectMain(state: HarnessState, harness: MainHarness) {
	if (state.main) throw new Error("Already a main connection.")
	return { ...state, main: harness }
}

function disconnectMain(state: HarnessState) {
	return { ...state, main: undefined }
}

function connectRenderer(state: HarnessState, harness: RendererHarness) {
	return { ...state, renderers: [...state.renderers, harness] }
}

function disconnectRenderer(state: HarnessState, harness: RendererHarness) {
	return {
		...state,
		renderers: state.renderers.filter((x) => x !== harness),
	}
}

const harnessReducers = {
	connectMain,
	disconnectMain,
	connectRenderer,
	disconnectRenderer,
}

export class TestHarness extends StateMachine<
	HarnessState,
	typeof harnessReducers
> {
	constructor() {
		super({ main: undefined, renderers: [] }, harnessReducers)
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
		mainPort: number = MAIN_PORT,
		rendererPort: number = RENDERER_PORT
	) {
		const harness = new TestHarness()

		const servers = await Promise.all([
			listenForTestHarnessSockets(mainPort, (socket) => {
				harness.dispatch.connectMain(MainHarness.create(socket))
			}),
			listenForTestHarnessSockets(rendererPort, async (socket) => {
				harness.dispatch.connectRenderer(await RendererHarness.create(socket))
			}),
		])

		harness.destroy = async () => {
			for (const server of servers) {
				server.destroy()
			}
		}

		return harness
	}
}
