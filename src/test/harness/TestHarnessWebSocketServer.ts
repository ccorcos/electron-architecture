import { WebSocket, WebSocketServer } from "ws"
import { DeferredPromise } from "../../app/shared/utils/DeferredPromise"
import { TestHarnessSocketApi } from "./TestHarness"
import { TestHarnessWebSocket } from "./TestHarnessWebSocket"

export async function listenForTestHarnessWebSockets(
	port: number,
	fn: (socket: TestHarnessSocketApi) => void
) {
	const sockets: WebSocket[] = []

	const deferred = new DeferredPromise()
	const server = new WebSocketServer({ port }, deferred.resolve)

	server.on("connection", (socket) => {
		sockets.push(socket)
		const harnessSocket = new TestHarnessWebSocket(socket)
		fn(harnessSocket)
	})

	await deferred.promise

	return {
		async destroy() {
			for (const socket of sockets) {
				socket.close()
			}
			return new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			)
		},
	}
}
