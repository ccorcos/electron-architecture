import { ipcRenderer, IpcRendererEvent } from "electron"
import { deserializeError, serializeError } from "serialize-error"
import { Asyncify, MainToRendererIPC, RendererToMainIPC } from "../IPC"

type CallMain = {
	[T in keyof RendererToMainIPC]: (
		...args: Parameters<RendererToMainIPC[T]>
	) => ReturnType<Asyncify<RendererToMainIPC[T]>>
}

export const callMain = new Proxy(
	{},
	{
		get(target, prop: any, receiver) {
			return (...args: any[]) => callMainFn(prop, ...args)
		},
	}
) as CallMain

function callMainFn<T extends keyof RendererToMainIPC>(
	channel: T,
	...args: Parameters<RendererToMainIPC[T]>
): ReturnType<Asyncify<RendererToMainIPC[T]>> {
	const promise = new Promise((resolve, reject) => {
		const responseChannel = `${channel}-${Date.now()}-${Math.random()}`

		const handler = (
			event: IpcRendererEvent,
			result: { data: any; error: any }
		) => {
			ipcRenderer.off(responseChannel, handler)
			if (result.error) {
				reject(deserializeError(result.error))
			} else {
				resolve(result.data)
			}
		}
		ipcRenderer.on(responseChannel, handler)
		ipcRenderer.send(channel as string, responseChannel, ...args)
	})

	return promise as any
}

type AnswerMain = {
	[T in keyof MainToRendererIPC]: (fn: MainToRendererIPC[T]) => () => void
}

export const answerMain = new Proxy(
	{},
	{
		get(target, prop: any, receiver) {
			return (fn: any) => answerMainFn(prop, fn)
		},
	}
) as AnswerMain

export function answerMainFn<T extends keyof MainToRendererIPC>(
	channel: T,
	fn: MainToRendererIPC[T]
) {
	const handler = async (
		event: IpcRendererEvent,
		responseChannel: string,
		...args: Array<any>
	) => {
		try {
			const result = await (fn as any)(...args)
			ipcRenderer.send(responseChannel, { data: result })
		} catch (error) {
			ipcRenderer.send(responseChannel, { error: serializeError(error) })
		}
	}
	ipcRenderer.on(channel as string, handler)
	return () => {
		ipcRenderer.off(channel as string, handler)
	}
}
