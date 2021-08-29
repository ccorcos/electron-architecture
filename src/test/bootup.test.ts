import * as nut from "@nut-tree/nut-js"
import { strict as assert } from "assert"
import * as child_process from "child_process"
import { describe, it } from "mocha"
import { DeferredPromise } from "../shared/DeferredPromise"
import { rootPath } from "../tools/rootPath"
import { createTestHarness, RendererHarness, TestHarness } from "./TestHarness"

nut.keyboard.config.autoDelayMs = 100
nut.mouse.config.autoDelayMs = 100
nut.mouse.config.mouseSpeed = 1000

async function bootup(cliArgs: string[] = []) {
	const harness = await createTestHarness()

	// Run the app.
	const cwd = rootPath(".")
	const cmd = rootPath("node_modules/.bin/electron")
	const args = [rootPath("build/main/main.js"), "--test", ...cliArgs]

	const child = child_process.spawn(cmd, args, {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	})

	const deferred = new DeferredPromise()

	// Kill the child process when the main process exits.
	const onExit = () => child.kill()
	process.on("exit", onExit)

	child.on("error", (err) => {
		process.off("exit", onExit)
		deferred.reject(err)
	})

	child.on("exit", (code, signal) => {
		process.off("exit", onExit)
		if (code !== 0) {
			deferred.reject(
				new Error(`Unexpected exit code ${code}. "${cmd} ${args.join(" ")}"`)
			)
		} else {
			deferred.resolve()
		}
	})

	// Monkey-patch destroy. Pretty gross...
	const destory = harness.destroy
	harness.destroy = async () => {
		await destory()
		child.kill("SIGINT")
		await deferred.promise
	}

	await harness.waitUntilReady()

	return harness
}

function test(
	testName: string,
	fn: (harness: TestHarness) => void | Promise<void>
) {
	return it(testName, async () => {
		const harness = await bootup()
		try {
			await fn(harness)
		} catch (error) {
			throw error
		} finally {
			await harness.destroy()
		}
	})
}

describe("WindowService", function () {
	this.timeout(100000)

	test("BootupApp", async (harness) => {
		assert.equal(harness.renderers.length, 1)

		// MetaKey is Super.
		// await nut.keyboard.pressKey(nut.Key.LeftSuper, nut.Key.N)
		// await nut.keyboard.releaseKey(nut.Key.LeftSuper, nut.Key.N)
		// await sleep(500)
		//
		// assert.equal(harness.renderers.length, 2)

		async function clickButton() {
			await click(harness.renderers[0], "button")
		}

		for (let i = 0; i < 10; i++) {
			await clickButton()
			// await sleep(500)
		}

		await sleep(5000)

		/*
			const window = app.main.windows[0]
			click("body button", window)

			move window around
			new window
		*/
	})
})

function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function measureDOM(renderer: RendererHarness, cssSelector: string) {
	const rect = await renderer.call.measureDOM("button")
	assert.ok(rect)

	const activeWindow = await nut.getActiveWindow()
	const region = await activeWindow.region
	const topbarHeight = 25

	const { x, y, width, height } = rect
	return { width, height, x: x + region.left, y: y + topbarHeight + region.top }
}

async function click(renderer: RendererHarness, cssSelector: string) {
	const rect = await measureDOM(renderer, cssSelector)
	await nut.mouse.move([
		{
			x: rect.x + rect.width / 2,
			y: rect.y + rect.height / 2,
		},
	])

	await nut.mouse.leftClick()
}
