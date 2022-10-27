import { ipcChannel, MainToRendererIPC, RendererToMainIPC } from "../shared/IPC"
import { IPCMessage, IPCPeer } from "../shared/IPCPeer"

// This comes from preload.ts using the contextBridge
const ipcRenderer: typeof import("electron").ipcRenderer = (window as any)
	.ipcRenderer

if (!ipcRenderer) throw new Error(`Expected Ipc Renderer to be defined`)

// Due to an issue with the contextBridge, its not possible to remove listeners
// from the ipcRenderer which creates a significant continuous degradation of
// performance. So we're going to only subscribe to the ipcChannel once and
// manage event listeners ourselves.
// https://github.com/ccorcos/electron-context-bridge-remove-listener-bug
// https://github.com/electron/electron/issues/33328
const ipcChannelListeners = new Set<(message: IPCMessage) => void>()

let addedIpcListener = false
function onIpcChannel(handler: (message: IPCMessage) => void) {
	ipcChannelListeners.add(handler)

	if (!addedIpcListener) {
		ipcRenderer.on(ipcChannel, (event, message) => {
			ipcChannelListeners.forEach((fn) => fn(message))
		})
		addedIpcListener = true
	}
	return () => ipcChannelListeners.delete(handler)
}

export class RendererIPCPeer extends IPCPeer<
	RendererToMainIPC,
	MainToRendererIPC
> {
	constructor() {
		super({
			send: (message) => {
				if (message.type === "request") {
					console.log("callMain", message.fn)
				} else {
					console.log("answerMain", message.fn)
				}
				ipcRenderer.send(ipcChannel, message)
			},
			listen(callback) {
				return onIpcChannel(callback)
			},
		})
	}
}
