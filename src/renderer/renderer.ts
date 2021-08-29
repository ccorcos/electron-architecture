// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import { DisplayWindowRectPlugin } from "./plugins/DisplayWindowRectPlugin"
import { SyncWindowRectPlugin } from "./plugins/SyncWindowRectPlugin"
import { RendererApp } from "./RendererApp"
import { callMain } from "./RendererIPC"

async function setupTestHarness(app: RendererApp) {
	const { connectRendererToTestHarness } = await import("../test/TestHarness")
	const harness = await connectRendererToTestHarness()

	harness.answer.measureDOM((css) => {
		const node = document.querySelector(css)
		if (!node) return
		const { x, y, width, height } = node.getBoundingClientRect()
		// Offset the window position
		const window = app.state.rect
		const topbar = 25
		return { x: x + window.x, y: topbar + y + window.y, width, height }
	})

	harness.answer.getState(() => app.state)

	app.onDispatch((action) => {
		harness.call.dispatchAction(action)
	})

	return harness
}

async function main() {
	const { test, rect } = await callMain.load()

	const app = new RendererApp({ rect }, [
		SyncWindowRectPlugin,
		DisplayWindowRectPlugin,
	])

	const harness = test ? await setupTestHarness(app) : undefined
}

main()
