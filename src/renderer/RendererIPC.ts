import { ipcRenderer, IpcRendererEvent } from "electron"
import { deserializeError, serializeError } from "serialize-error"
import { MainToRendererIPC, RendererToMainIPC } from "../IPC"
import { createProxy } from "../shared/proxyHelpers"
import { Answerer, Asyncify, Caller } from "../shared/typeHelpers"

type CallMain = Caller<RendererToMainIPC>

export const callMain = createProxy<CallMain>((fn, ...args: any) =>
	callMainFn(fn, ...args)
)

type AnswerMain = Answerer<MainToRendererIPC>

export const answerMain = createProxy<AnswerMain>((fn, callback) =>
	answerMainFn(fn, callback)
)

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
