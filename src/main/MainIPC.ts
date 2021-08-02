import { BrowserWindow, ipcMain, IpcRendererEvent } from "electron"
import { IpcMainEvent } from "electron/main"
import { deserializeError, serializeError } from "serialize-error"
import { Async, MainToRendererIPC, RendererToMainIPC } from "../IPC"

export function answerRenderer<T extends keyof RendererToMainIPC>(
	browserWindow: BrowserWindow,
	channel: T,
	fn: (
		...args: Parameters<RendererToMainIPC[T]>
	) => ReturnType<RendererToMainIPC[T]>
) {
	const handler = async (
		event: IpcRendererEvent,
		ipcChannel: string,
		responseChannel: string,
		...args: Array<any>
	) => {
		if (ipcChannel !== channel) return
		try {
			const result = await (fn as any)(...args)
			browserWindow.webContents.send(responseChannel, { data: result })
		} catch (error) {
			browserWindow.webContents.send(responseChannel, {
				error: serializeError(error),
			})
		}
	}
	browserWindow.webContents.on("ipc-message", handler)
	return () => {
		browserWindow.webContents.off("ipc-message", handler)
	}
}

// NOTE: this is specifically for use with VirtualBrowserWindow.props.onIpcMessage
export function ipcMessageHandler(
	args: {
		[Channel in keyof RendererToMainIPC]?: (
			...args: Parameters<RendererToMainIPC[Channel]>
		) => ReturnType<RendererToMainIPC[Channel]>
	}
) {
	return async (
		browserWindow: BrowserWindow,
		ipcChannel: string,
		responseChannel: string,
		...args: Array<any>
	) => {
		const fn = args[ipcChannel as any]
		if (!fn) return
		try {
			const result = await (fn as any)(...args)
			browserWindow.webContents.send(responseChannel, { data: result })
		} catch (error) {
			browserWindow.webContents.send(responseChannel, {
				error: serializeError(error),
			})
		}
	}
}

export function callRenderer<T extends keyof MainToRendererIPC>(
	browserWindow: BrowserWindow,
	channel: T,
	...args: Parameters<MainToRendererIPC[T]>
): ReturnType<Async<MainToRendererIPC[T]>> {
	const promise = new Promise((resolve, reject) => {
		const responseChannel = `${channel}-${Date.now()}-${Math.random()}`

		const handler = (
			event: IpcMainEvent,
			result: { data: any; error: any }
		) => {
			ipcMain.off(responseChannel, handler)
			if (result.error) {
				reject(deserializeError(result.error))
			} else {
				resolve(result.data)
			}
		}
		ipcMain.on(responseChannel, handler)
		browserWindow.webContents.send(channel as string, responseChannel, ...args)
	})

	return promise as any
}
