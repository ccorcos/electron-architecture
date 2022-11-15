import { createServer, Socket } from "net"
import { TestHarnessSocketApi } from "./TestHarness"
import { TestHarnessTcpSocket } from "./TestHarnessTcpSocket"

export async function listenForTestHarnessTcpSockets(
	port: number,
	fn: (socket: TestHarnessSocketApi) => void
) {
	const sockets: Socket[] = []

	const server = createServer(async (socket) => {
		sockets.push(socket)
		const harnessSocket = new TestHarnessTcpSocket(socket)
		fn(harnessSocket)
	})

	await new Promise<void>((resolve) =>
		server.listen(port, "127.0.0.1", resolve)
	)

	return {
		async destroy() {
			for (const socket of sockets) {
				socket.destroy()
			}
			return new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			)
		},
	}
}
