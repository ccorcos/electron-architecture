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

export class IPCPeer<
	CallAPI extends AnyFunctionMap = AnyFunctionMap,
	AnswerAPI extends AnyFunctionMap = AnyFunctionMap
> {
	constructor(
		private config: {
			send(message: IPCMessage): Promise<void> | void
			listen(callback: (message: IPCMessage) => void): () => void
		}
	) {
		const stopListening = this.config.listen(this.answerFn)
		this.listeners.add(stopListening)
	}

	private listeners = new Set<() => void>()
	private answerers = new Map<string, (...args: any[]) => Promise<any>>()
	private subscriptions = new Map<string, Set<() => void>>()

	call = createProxy<Caller<CallAPI>>((fn: any, ...args: any) =>
		this.callFn(fn, ...args)
	)

	answer = createProxy<Answerer<AnswerAPI>>((fn: any, callback: any) =>
		this.setAnswerer(fn, callback)
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

	answerFn = async (message: IPCMessage) => {
		if (message.type !== "request") return
		const { fn } = message

		try {
			const answerer = this.answerers.get(fn)
			if (!answerer) {
				throw new Error(
					`Could not handle message ${fn}: there were no answerers set to handle this message`
				)
			}

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

			const data = await Promise.resolve(answerer(...args))

			if (isFunction(data)) {
				const unsubscribe = this.config.listen(async (msg) => {
					if (message.id !== msg.id) return
					if (msg.type !== "unsubscribe") return
					unsubscribe()
					this.subscriptions.get(fn)?.delete(unsubscribe)
					data()
				})
				const set = this.subscriptions.get(fn)
				if (!set) {
					const set = new Set<() => void>()
					set.add(unsubscribe)
					this.subscriptions.set(fn, set)
				} else {
					set.add(unsubscribe)
				}

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
	}

	setAnswerer(fn: string, callback: (...args: any[]) => Promise<any>) {
		if (this.answerers.get(fn)) {
			throw new Error(`Overriding answerer for ${fn}`)
		}

		this.answerers.set(fn, callback)

		const cleanup = () => {
			const subscriptions = this.subscriptions.get(fn)
			subscriptions?.forEach((unsub) => unsub())
		}

		this.listeners.add(cleanup)

		return () => {
			this.answerers.delete(fn)
			this.listeners.delete(cleanup)

			cleanup()
		}
	}

	destroy() {
		for (const [key, subscription] of this.subscriptions) {
			subscription.forEach((unsub) => unsub())
		}
		this.listeners.forEach((fn) => fn())
		this.listeners = new Set()
	}
}
