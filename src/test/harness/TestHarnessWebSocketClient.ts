// import { WebSocket } from "ws"
import { AnyFunctionMap } from "../../shared/typeHelpers"
import { TestHarnessWebSocket } from "./TestHarnessWebSocket"

// We need to separate the Client/Server into separate files so that we aren't trying
// to bundle Node.js apis in the frontend.
export async function connectToTestHarnessWebSocket<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
>(port: number) {
	const socket = new WebSocket("ws://127.0.0.1:" + port)
	await new Promise<void>((resolve) => {
		socket.onopen = () => resolve()
	})
	return new TestHarnessWebSocket(socket)
}
