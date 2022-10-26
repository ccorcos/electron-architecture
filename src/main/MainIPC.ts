import { BrowserWindow } from "electron"
import { ipcChannel, MainToRendererIPC, RendererToMainIPC } from "../shared/ipc"
import { IPCMessage, IPCPeer } from "../shared/IPCPeer"

/** An IPC peer to communicate with the main process */
export class MainIPCPeer extends IPCPeer<MainToRendererIPC, RendererToMainIPC> {
	constructor(browserWindow: BrowserWindow) {
		browserWindow.webContents.setMaxListeners(15)

		super({
			send: (message) => {
				if (browserWindow.webContents.isDestroyed()) return
				if (message.type === "request") {
					console.log("callRenderer", message.fn)
				} else {
					console.log(
						"answerRenderer",
						message.fn
						// message.type === "response" ? message.data : ""
					)
				}
				browserWindow.webContents.send(ipcChannel, message)
			},
			listen(callback) {
				const handler = async (
					event: any,
					channel: any,
					message: IPCMessage
				) => {
					if (channel !== ipcChannel) return
					callback(message)
				}
				browserWindow.webContents.on("ipc-message", handler)
				return () => {
					browserWindow.webContents.off("ipc-message", handler)
				}
			},
		})
	}
}
