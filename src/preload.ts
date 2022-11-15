// Expose the ipcRenderer on the window for communication with the main process.

import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("ipcRenderer", {
	// @ts-ignore
	send: (...args: any[]) => ipcRenderer.send(...args),
	// @ts-ignore
	on: (...args) => ipcRenderer.on(...args),
	// NOTE: this off method doesn't work!
	// https://github.com/electron/electron/issues/33328
	// @ts-ignore
	off: (...args) => ipcRenderer.off(...args),
	// @ts-ignore
	listenerCount: (...args) => ipcRenderer.listenerCount(...args),
})
