import { RENDERER_PORT, TestHarnessIpc } from "./TestHarness"
import { HarnessToRenderer, RendererToHarness } from "./TestHarnessApi"
import { connectToTestHarnessWebSocket } from "./TestHarnessWebSocketClient"

// This code gets executed in the Renderer process.
export class RendererTestHarnessClient extends TestHarnessIpc<
	RendererToHarness,
	HarnessToRenderer
> {}

export async function connectRendererToTestHarness() {
	const socket = await connectToTestHarnessWebSocket(RENDERER_PORT)
	return new RendererTestHarnessClient(socket)
}
