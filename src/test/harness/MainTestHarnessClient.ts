import { MAIN_PORT, TestHarnessIpc } from "./TestHarness"
import { HarnessToMain, MainToHarness } from "./TestHarnessApi"
import { connectToTestHarnessTcpSocket } from "./TestHarnessTcpSocketClient"

// This code gets executed in the Main process.
export class MainTestHarnessClient extends TestHarnessIpc<
	MainToHarness,
	HarnessToMain
> {}

export async function connectMainToTestHarness() {
	const socket = await connectToTestHarnessTcpSocket(MAIN_PORT)
	return new MainTestHarnessClient(socket)
}
