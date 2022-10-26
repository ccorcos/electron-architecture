import type { WebSocket as WebSocketLib } from "ws"
import { TestHarnessSocketApi } from "./TestHarness"

type Listener = (message: any) => void

export class TestHarnessWebSocket implements TestHarnessSocketApi {
	private listeners = new Set<Listener>()

	constructor(private socket: WebSocket | WebSocketLib) {
		socket.onmessage = (event: MessageEvent) => {
			const str = event.data.toString("utf8")
			const message = JSON.parse(str)
			this.listeners.forEach((listener) => {
				listener(message)
			})
		}
	}

	async send(message: any) {
		this.socket.send(JSON.stringify(message))
	}

	onMessage(listener: Listener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	destroy() {
		this.socket.close()
	}

	onClose(fn: () => void) {
		this.socket.onclose = fn
		return () => {
			this.socket.onclose = null
		}
	}
}
