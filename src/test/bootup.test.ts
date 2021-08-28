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

async function bootup(cliArgs: string[] = []) {
	// const harnessServer = await createTestHarnessServer()

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

	// Wait til the application is ready.
	// await harnessServer.ready()

	// const { mainApp, rendererApp } = harnessServer

	return {
		// mainApp,
		// rendererApp,
		// partition,
		async close() {
			// harnessServer.close()
			child.kill("SIGINT")
			await deferred.promise
		},
		closed() {
			return deferred.promise
		},
	}
}

describe("WindowService", function () {
	this.timeout(100000)

	it("BootupApp", async () => {
		const app = await bootup()
		console.log("Ready")

		await sleep(2000)
		console.log("Closing")
		await app.close()
	})
})

function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
