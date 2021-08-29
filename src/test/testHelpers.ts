import * as nut from "@nut-tree/nut-js"
import { strict as assert } from "assert"
import * as child_process from "child_process"
import { it } from "mocha"
import { DeferredPromise } from "../shared/DeferredPromise"
import { rootPath } from "../tools/rootPath"
import { createTestHarness, RendererHarness, TestHarness } from "./TestHarness"

nut.keyboard.config.autoDelayMs = 100
nut.mouse.config.autoDelayMs = 100
nut.mouse.config.mouseSpeed = 1000

export async function bootup(cliArgs: string[] = []) {
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

export function test(
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

export async function measureDOM(
	renderer: RendererHarness,
	cssSelector: string
) {
	const rect = await renderer.call.measureDOM(cssSelector)
	assert.ok(rect)
	return rect
}

export async function click(renderer: RendererHarness, cssSelector: string) {
	const rect = await measureDOM(renderer, cssSelector)
	await nut.mouse.move([
		{
			x: rect.x + rect.width / 2,
			y: rect.y + rect.height / 2,
		},
	])

	await nut.mouse.leftClick()
}

export function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
