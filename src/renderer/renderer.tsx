// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

import React, { useState } from "react"
import ReactDOM from "react-dom"
import { SyncWindowRectPlugin } from "./plugins/SyncWindowRectPlugin"
import { RendererApp } from "./RendererApp"
import { RendererEnvironment } from "./RendererEnvironment"
import { RendererIPCPeer } from "./RendererIPC"

async function setupTestHarness(app: RendererApp) {
	const { connectRendererToTestHarness } = await import(
		"../test/harness/RendererTestHarnessClient"
	)
	const harness = await connectRendererToTestHarness()

	harness.answer.measureDOM((css) => {
		const node = document.querySelector(css)
		if (!node) return
		const { left, top, width, height } = node.getBoundingClientRect()
		// Offset the window position
		const window = app.state.rect
		const topbar = 25
		return {
			left: left + window.x,
			top: topbar + top + window.y,
			width,
			height,
		}
	})

	harness.answer.getState(() => app.state)

	app.onDispatch((action) => {
		harness.call.dispatchAction(action)
	})

	return harness
}

function App(props: { ipc: RendererIPCPeer }) {
	const [count, setCount] = useState(0)

	return (
		<div>
			<h1>Hello, world!</h1>
			<div style={{ display: "flex", gap: 8 }}>
				<button onClick={() => setCount(count + 1)}>increment</button>
				<span aria-label="count">{count}</span>
				<button onClick={() => setCount(count - 1)}>decrement</button>
			</div>
		</div>
	)
}

async function main() {
	const ipc = new RendererIPCPeer()
	const { test, rect } = await ipc.call.load()

	const app = new RendererApp({ rect })

	const harness = test ? await setupTestHarness(app) : undefined

	const environment: RendererEnvironment = { ipc, app, harness }

	app.plug(new SyncWindowRectPlugin(environment))

	const root = document.querySelector("#react-root")
	if (!root) throw new Error("React root not found")

	ReactDOM.render(<App ipc={ipc} />, root)

	harness?.call.ready()
}

main()
