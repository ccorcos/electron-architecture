import * as nut from "@nut-tree/nut-js"
import { strict as assert } from "assert"
import * as child_process from "child_process"
import { describe, it } from "mocha"
import { DeferredPromise } from "../shared/DeferredPromise"
import { rootPath } from "../tools/rootPath"
import { createAppTestHarness } from "./AppTestHarness"

nut.keyboard.config.autoDelayMs = 100
nut.mouse.config.autoDelayMs = 100
nut.mouse.config.mouseSpeed = 1000

async function bootup(cliArgs: string[] = []) {
	const harness = await createAppTestHarness()

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

	// Wait til the application is ready.
	// await harnessServer.ready()

	// const { mainApp, rendererApp } = harnessServer

	await harness.waitUntilReady()

	return harness
}

describe("WindowService", function () {
	this.timeout(100000)

	it("BootupApp", async () => {
		const harness = await bootup()

		try {
			console.log("Ready")
			assert.equal(harness.renderers.length, 1)

			// MetaKey is Super.
			// await nut.keyboard.pressKey(nut.Key.LeftSuper, nut.Key.N)
			// await nut.keyboard.releaseKey(nut.Key.LeftSuper, nut.Key.N)
			// await sleep(500)
			//
			// assert.equal(harness.renderers.length, 2)

			async function clickButton() {
				const rect = await harness.renderers[0].call.measureDOM("button")
				assert.ok(rect)

				const activeWindow = await nut.getActiveWindow()
				const region = await activeWindow.region
				const topbarHeight = 25

				await nut.mouse.move([
					{
						x: region.left + rect.x + rect.width / 2,
						y: topbarHeight + region.top + rect.y + rect.height / 2,
					},
				])

				await nut.mouse.leftClick()
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
		} catch (error) {
			throw error
		} finally {
			console.log("Closing")
			await harness.destroy()
		}
	})
})

function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
