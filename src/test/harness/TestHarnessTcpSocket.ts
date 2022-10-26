import { Socket } from "net"
import { TestHarnessSocketApi } from "./TestHarness"

type Listener = (message: any) => void

/**
 * A thin wrapper around a net.Socket that uses a null byte to separate JSON messages.
 */
export class TestHarnessTcpSocket implements TestHarnessSocketApi {
	private listeners = new Set<Listener>()

	constructor(private socket: Socket) {
		socket.setNoDelay(true)

		let leftOver = ""
		socket.on("data", (data) => {
			const str = leftOver + data.toString("utf8")
			const chunks = str.split("\x00").filter(Boolean)

			if (!str.endsWith("\x00")) {
				leftOver = chunks[chunks.length - 1]
				chunks.splice(chunks.length - 1, 1)
			} else {
				leftOver = ""
			}

			for (const chunk of chunks) {
				const message = JSON.parse(chunk)
				this.listeners.forEach((listener) => {
					listener(message)
				})
			}
		})
	}

	async send(message: any) {
		return new Promise<void>((resolve, reject) => {
			const data = JSON.stringify(message) + "\x00"
			this.socket.write(data, (error) => {
				if (error) reject(error)
				else resolve()
			})
		})
	}

	onMessage(listener: Listener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	destroy() {
		this.socket.destroy()
	}

	onClose(fn: () => void) {
		this.socket.on("close", fn)
		return () => this.socket.off("close", fn)
	}
}
