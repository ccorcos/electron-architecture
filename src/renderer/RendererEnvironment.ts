import { RendererHarnessApi } from "../test/TestHarness"
import { RendererApp } from "./RendererApp"
import { RendererIPCPeer } from "./RendererIPC"

export type RendererEnvironment = {
	ipc: RendererIPCPeer
	app: RendererApp
	harness?: RendererHarnessApi
}
