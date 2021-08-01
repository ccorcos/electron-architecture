import { ipcRenderer, IpcRendererEvent } from "electron"
import { serializeError, deserializeError } from "serialize-error"
import { RendererToMainIPC, MainToRendererIPC, Async } from "./IPC"

export function callMain<T extends keyof RendererToMainIPC>(
	channel: T,
	...args: Parameters<RendererToMainIPC[T]>
): ReturnType<Async<RendererToMainIPC[T]>> {
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

export function answerMain<T extends keyof MainToRendererIPC>(
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
