import { BrowserWindow, ipcMain, IpcRendererEvent } from "electron"
import { IpcMainEvent } from "electron/main"
import { deserializeError, serializeError } from "serialize-error"
import { Asyncify, MainToRendererIPC, RendererToMainIPC } from "../IPC"

type AnswerRenderer = {
	[T in keyof RendererToMainIPC]: (
		browserWindow: BrowserWindow,
		fn: RendererToMainIPC[T]
	) => () => void
}

export const answerRenderer = new Proxy(
	{},
	{
		get(target, prop: any, receiver) {
			return (browserWindow: BrowserWindow, fn: any) =>
				answerRendererFn(browserWindow, prop, fn)
		},
	}
) as AnswerRenderer

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

type CallRenderer = {
	[T in keyof MainToRendererIPC]: (
		browserWindow: BrowserWindow,
		...args: Parameters<MainToRendererIPC[T]>
	) => ReturnType<Asyncify<MainToRendererIPC[T]>>
}

export const callRenderer = new Proxy(
	{},
	{
		get(target, prop: any, receiver) {
			return (browserWindow: BrowserWindow, ...args: any[]) =>
				callRendererFn(browserWindow, prop, ...args)
		},
	}
) as CallRenderer

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
