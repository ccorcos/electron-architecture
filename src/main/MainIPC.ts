import { BrowserWindow, ipcMain, IpcRendererEvent } from "electron"
import { IpcMainEvent } from "electron/main"
import { deserializeError, serializeError } from "serialize-error"
import { MainToRendererIPC, RendererToMainIPC } from "../IPC"
import { createProxy } from "../shared/proxyHelpers"
import { Asyncify } from "../shared/typeHelpers"

type CallRenderer = {
	[T in keyof MainToRendererIPC]: (
		browserWindow: BrowserWindow,
		...args: Parameters<MainToRendererIPC[T]>
	) => ReturnType<Asyncify<MainToRendererIPC[T]>>
}

export const callRenderer = createProxy<CallRenderer>(
	(fn, browserWindow, ...args: any) =>
		callRendererFn(browserWindow, fn, ...args)
)

type AnswerRenderer = {
	[T in keyof RendererToMainIPC]: (
		browserWindow: BrowserWindow,
		fn: RendererToMainIPC[T]
	) => () => void
}

export const answerRenderer = createProxy<AnswerRenderer>(
	(fn, browserWindow, callback) => answerRendererFn(browserWindow, fn, callback)
)

function answerRendererFn<T extends keyof RendererToMainIPC>(
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

function callRendererFn<T extends keyof MainToRendererIPC>(
	browserWindow: BrowserWindow,
	channel: T,
	...args: Parameters<MainToRendererIPC[T]>
): ReturnType<Asyncify<MainToRendererIPC[T]>> {
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
