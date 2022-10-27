import { strict as assert } from "assert"
import EventEmitter from "events"
import { after, describe, it } from "mocha"
import { IPCPeer } from "./IPCPeer"
import { sleep } from "./sleep"
import { AnyFunctionMap } from "./typeHelpers"

function setupPeers<
	A2B extends AnyFunctionMap = AnyFunctionMap,
	B2A extends AnyFunctionMap = AnyFunctionMap
>() {
	const aEvents = new EventEmitter()
	const bEvents = new EventEmitter()

	const a = new IPCPeer<A2B, B2A>({
		send: (message) => {
			bEvents.emit("event", message)
		},
		listen: (callback) => {
			aEvents.on("event", callback)
			return () => aEvents.off("event", callback)
		},
	})

	const b = new IPCPeer<B2A, A2B>({
		send: (message) => {
			aEvents.emit("event", message)
		},
		listen: (callback) => {
			bEvents.on("event", callback)
			return () => bEvents.off("event", callback)
		},
	})
	return { a, b }
}

describe("IPCPeer", () => {
	it("works", async () => {
		const { a, b } = setupPeers()

		const stopB = b.setAnswerer("add", (x, y) => x + y)
		const stopA = a.setAnswerer("double", (x) => x + x)

		assert.equal(await a.callFn("add", 10, 2), 12)
		assert.equal(await b.callFn("double", 10), 20)
	})

	it.skip("Stop listening works", async () => {})
	it.skip("Destroy works", async () => {})

	it("Works with proxy types", async () => {
		type A = {
			add(x: number, y: number): number
		}

		type B = {
			double(x: number): number
		}

		const { a, b } = setupPeers<A, B>()

		const stopB = b.answer.add((x, y) => x + y)
		const stopA = a.answer.double((x) => x + x)

		assert.equal(await a.call.add(10, 2), 12)
		assert.equal(await b.call.double(10), 20)
	})

	it("Subscribes", async () => {
		type A = {
			count(n: number, cb: (count: number) => void): () => void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()

		const stopB = b.answer.count((initialCount, cb) => {
			let n = initialCount
			const timerId = setInterval(() => {
				n += 1
				cb(n)
			}, 1)

			return () => {
				clearInterval(timerId)
			}
		})

		const results: number[] = []
		const unsub = await a.call.count(12, (n) => {
			results.push(n)
		})
		assert.equal(typeof unsub, "function")
		await sleep(10)
		unsub()

		const len = results.length
		assert.deepEqual(results.slice(0, 5), [13, 14, 15, 16, 17])
		await sleep(10)

		assert.equal(len, results.length)
	})

	it("Deserializes error with combined stack traces.", async () => {
		type A = {
			doSomething(): void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()

		function somethingHelper() {
			throw new Error("error")
		}

		const stopB = b.answer.doSomething(() => {
			somethingHelper()
		})
		after(stopB)

		try {
			await a.call.doSomething()
			assert.fail()
		} catch (error) {
			const stack = error.stack as string

			assert.ok(
				stack.includes("doSomething"),
				"Record local stack trace to the doSomething() call."
			)
			assert.ok(
				stack.includes("somethingHelper"),
				"Record remote stack trace to the somethingHelper() call."
			)
		}
	})

	it("Rethrows error", async () => {
		type A = {
			doSomething(): void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()
		const stopB = b.answer.doSomething(() => {
			throw new Error("error")
		})
		after(stopB)

		await assert.rejects(() => a.call.doSomething())
	})

	it("Adding multiple answerer for same fn results in error", async () => {
		type A = {
			add(x: number, y: number): number
		}

		type B = {
			double(x: number): number
		}

		const { a, b } = setupPeers<A, B>()

		const stopB = b.answer.add((x, y) => x + y)
		after(stopB)

		assert.throws(() => {
			b.answer.add((x, y) => x * y)
		})

		// Assert the older one persisted
		assert.equal(await a.call.add(5, 5), 10)
	})

	it("Throws error if there is no answerer set.", async () => {
		const { a, b } = setupPeers()

		await assert.rejects(() => b.callFn("nothing"))

		a.setAnswerer("nothing", async () => "nothing")

		assert.equal(await b.callFn("nothing"), "nothing")
	})
})
