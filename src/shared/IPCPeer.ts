import { isFunction } from "lodash"
import { deserializeError, serializeError } from "serialize-error"
import { createProxy } from "./createProxy"
import { Answerer, AnyFunctionMap, Caller } from "./typeHelpers"

type IPCRequestMessage = {
	type: "request"
	fn: string
	id: string
	args: any[]
	callbacks: number[]
}

type IPCResponseMessage = {
	type: "response"
	fn: string
	id: string
	data?: any
	error?: any
}

type IPCCallbackMessage = {
	type: "callback"
	fn: string
	id: string
	callback: number
	args: any[]
}

type IPCUnsubscribeMessage = {
	type: "unsubscribe"
	fn: string
	id: string
}

export type IPCMessage =
	| IPCRequestMessage
	| IPCResponseMessage
	| IPCCallbackMessage
	| IPCUnsubscribeMessage

// Note: if you call answer twice for the same function, they will both get called and race.
// You can catch this in the listen argument to the contructor, but its your responsibility.
export class IPCPeer<
	CallAPI extends AnyFunctionMap = AnyFunctionMap,
	AnswerAPI extends AnyFunctionMap = AnyFunctionMap
> {
	constructor(
		private config: {
			send(message: IPCMessage): Promise<void> | void
			listen(callback: (message: IPCMessage) => void): () => void
		}
	) {}

	private listeners = new Set<() => void>()

	call = createProxy<Caller<CallAPI>>((fn: any, ...args: any) =>
		this.callFn(fn, ...args)
	)

	answer = createProxy<Answerer<AnswerAPI>>((fn: any, callback: any) =>
		this.answerFn(fn, callback)
	)

	callFn(fn: string, ...args: any[]) {
		const callbacks: number[] = []
		const argsJson = args.map((arg, i) => {
			if (isFunction(arg)) {
				callbacks.push(i)
				return null
			}
			return arg
		})

		const request: IPCRequestMessage = {
			type: "request",
			id: `${fn}-${Math.random()}`,
			fn,
			args: argsJson,
			callbacks,
		}

		let stopListeningCallback: (() => void) | undefined
		if (callbacks.length) {
			stopListeningCallback = this.config.listen((message) => {
				if (message.id !== request.id) return
				if (message.type !== "callback") return
				args[message.callback](...message.args)
			})
			this.listeners.add(stopListeningCallback)
		}

		const promise = new Promise<any>((resolve, reject) => {
			const stopListening = this.config.listen((message) => {
				if (message.id !== request.id) return
				if (message.type !== "response") return
				this.listeners.delete(stopListening)
				stopListening()
				if (message.error) {
					const localError = new Error(fn)
					const remoteError = message.error as Error

					const combinedMessage = [
						localError.message,
						message.error.message,
					].join(" > ")

					const combinedStack = [localError.stack, remoteError.stack].join("\n")

					const combinedError = deserializeError({
						...remoteError,
						message: combinedMessage,
						stack: combinedStack,
					})

					reject(combinedError)
				} else {
					if (callbacks.length) {
						resolve(() => {
							if (stopListeningCallback) {
								stopListeningCallback()
								this.listeners.delete(stopListeningCallback)
							}
							this.config.send({
								type: "unsubscribe",
								fn: request.fn,
								id: request.id,
							})
						})
					} else {
						resolve(message.data)
					}
				}
			})
			this.listeners.add(stopListening)
			this.config.send(request)
		})

		return promise
	}

	answerFn(fn: string, callback: (...args: any[]) => Promise<any>) {
		const subscriptions = new Set<() => void>()

		const stopListening = this.config.listen(async (message) => {
			if (message.fn !== fn) return
			if (message.type !== "request") return
			try {
				const args = [...message.args]
				for (const i of message.callbacks) {
					args[i] = async (...cbArgs: any[]) => {
						await this.config.send({
							type: "callback",
							fn: message.fn,
							id: message.id,
							callback: i,
							args: cbArgs,
						})
					}
				}

				const data = await callback(...args)

				if (isFunction(data)) {
					const unsubscribe = this.config.listen(async (msg) => {
						if (message.id !== msg.id) return
						if (msg.type !== "unsubscribe") return
						unsubscribe()
						subscriptions.delete(unsubscribe)
						data()
					})
					subscriptions.add(unsubscribe)

					const response: IPCResponseMessage = {
						type: "response",
						id: message.id,
						fn,
					}
					await this.config.send(response)
				} else {
					const response: IPCResponseMessage = {
						type: "response",
						id: message.id,
						fn,
						data,
					}
					await this.config.send(response)
				}
			} catch (error) {
				const response: IPCResponseMessage = {
					type: "response",
					id: message.id,
					fn,
					error: serializeError(error),
				}
				await this.config.send(response)
			}
		})
		this.listeners.add(stopListening)

		const cleanup = () => subscriptions.forEach((unsub) => unsub())
		this.listeners.add(cleanup)

		return () => {
			this.listeners.delete(stopListening)
			stopListening()

			this.listeners.delete(cleanup)
			this.listeners.add(cleanup)
		}
	}

	destroy() {
		this.listeners.forEach((fn) => fn())
		this.listeners = new Set()
	}
}
