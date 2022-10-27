import { Socket } from "net"
import { AnyFunctionMap } from "../../shared/typeHelpers"
import { TestHarnessTcpSocket } from "./TestHarnessTcpSocket"

export async function connectToTestHarnessTcpSocket<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
>(port: number) {
	const socket = new Socket()
	await new Promise<void>((resolve) =>
		socket.connect(port, "127.0.0.1", resolve)
	)
	return new TestHarnessTcpSocket(socket)
}
