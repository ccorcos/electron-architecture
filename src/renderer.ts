// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import {
	updateRendererState,
	WindowRectPlugin,
	WindowRectViewPlugin,
} from "./RendererApp"
import { callMain } from "./RendererIPC"
import { RendererApp } from "./state"

async function main() {
	const rect = await callMain("load")
	const app = new RendererApp({ rect }, updateRendererState, [
		WindowRectPlugin,
		WindowRectViewPlugin,
	])
}

main()
