import { RendererTestHarnessClient } from "../test/harness/RendererTestHarnessClient"
import { RendererApp } from "./RendererApp"
import { RendererIPCPeer } from "./RendererIPC"

export type RendererEnvironment = {
	ipc: RendererIPCPeer
	app: RendererApp
	harness?: RendererTestHarnessClient
}
