// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import {
	RendererApp,
	SyncWindowRectPlugin,
	DisplayWindowRectPlugin,
} from "./RendererApp"
import { callMain } from "./RendererIPC"

async function main() {
	const rect = await callMain("load")
	const app = new RendererApp({ rect }, [
		SyncWindowRectPlugin,
		DisplayWindowRectPlugin,
	])
}

main()
