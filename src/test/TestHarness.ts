import * as net from "net"
import { createProxy } from "../shared/proxyHelpers"
import { Answerer, AnyFunctionMap, Caller } from "../shared/typeHelpers"

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

type Message = { fn: string; args: any[] }

type Listener = (message: Message) => void

class TestHarnessSocket {
	private listeners = new Set<Listener>()

	constructor(private socket: net.Socket) {
		socket.on("data", (data) => {
			for (const message of parseMessages(data)) {
				this.listeners.forEach((listener) => {
					listener(message)
				})
			}
		})
	}

	send(message: Message) {
		this.socket.write(serializeMessage(message))
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
		this.socket.send({ fn, args })
		// TODO: return the response.
	})

	answer = createProxy<Answerer<A>>((fn, callback) => {
		return this.socket.onMessage((message) => {
			if (message.fn === fn) {
				callback(...message.args)
				// TODO: return the response
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
	socket.setNoDelay(true)
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

export class TestHarness<
	Cm extends AnyFunctionMap,
	Am extends AnyFunctionMap,
	Cr extends AnyFunctionMap,
	Ar extends AnyFunctionMap
> {
	main: TestHarnessConnection<Cm, Am> | undefined
	renderers: TestHarnessConnection<Cr, Ar>[] = []
	async destroy() {}
}

export async function createTestHarness<
	Cm extends AnyFunctionMap,
	Am extends AnyFunctionMap,
	Cr extends AnyFunctionMap,
	Ar extends AnyFunctionMap
>(mainPort: number, rendererPort: number) {
	const harness = new TestHarness<Cm, Am, Cr, Ar>()

	const servers = await Promise.all([
		listenForTestHarnessConnections<Cr, Ar>(rendererPort, (connection) => {
			harness.renderers.push(connection)
			connection.onClose(() => {
				const index = harness.renderers.indexOf(connection)
				if (index !== -1) harness.renderers.splice(index, 1)
			})
		}),
		listenForTestHarnessConnections<Cm, Am>(mainPort, (connection) => {
			if (harness.main) throw new Error("Already a main connection.")
			harness.main = connection
			connection.onClose(() => {
				harness.main = undefined
			})
		}),
	])

	harness.destroy = async () => {
		for (const server of servers) {
			server.destroy()
		}
	}

	return harness
}
