// import * as nut from "@nut-tree/nut-js"
// import { createTestHarnessServer } from "../../test/TestHarness"
// import { tmpDir } from "../../test/tmpDir"
// import { rootPath } from "../../tools/rootPath"
// import { DeferredPromise } from "../shared/promiseHelpers"
// nut.keyboard.config.autoDelayMs = 0.1
// nut.mouse.config.autoDelayMs = 0.1
// nut.mouse.config.mouseSpeed = 3000
// Tests
// - start fresh, type, save doc, quit
// - restart, same doc should be open.
import * as child_process from "child_process"
// import * as child_process from "child_process"
// import * as fs from "fs-extra"
import { describe, it } from "mocha"
import { DeferredPromise } from "../shared/DeferredPromise"
import { rootPath } from "../tools/rootPath"
import { createAppTestHarness } from "./AppTestHarness"

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

	return harness
}

describe("WindowService", function () {
	this.timeout(100000)

	it("BootupApp", async () => {
		const harness = await bootup()
		console.log("Ready")

		await sleep(2000)

		/*

		harness.main.
		app.main.windows.length === 1
		type("Meta-N")
		app.main.windows.length === 2

		const window = app.main.windows[0]
		click("body button", window)


		move window around
		new window


		*/

		console.log("Closing")
		await harness.destroy()
	})
})

function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
