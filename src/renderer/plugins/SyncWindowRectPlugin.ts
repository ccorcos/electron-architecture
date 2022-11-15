import { RendererApp } from "../RendererApp"
import { RendererEnvironment } from "../RendererEnvironment"
import { RendererIPCPeer } from "../RendererIPC"
import { RendererState } from "../RendererState"

/**
 * Updates the local state to match the main process state.
 */
export class SyncWindowRectPlugin {
	private ipc: RendererIPCPeer
	private app: RendererApp
	private listeners: (() => void)[] = []

	constructor(environment: RendererEnvironment) {
		const { ipc, app } = environment
		this.ipc = ipc
		this.app = app
	}

	update(prevState: RendererState) {
		const nextState = this.app.state
		if (nextState === prevState) return
		if (nextState.rect === prevState.rect) return

		const nextRect = nextState.rect
		const prevRect = prevState.rect

		if (nextRect.x !== prevRect.x || nextRect.y !== prevRect.y) {
			this.ipc.call.setPosition(nextRect)
		}

		if (
			nextRect.width !== prevRect.width ||
			nextRect.height !== prevRect.height
		) {
			this.ipc.call.setSize(nextRect)
		}
	}

	destroy() {
		this.listeners.forEach((fn) => fn())
	}
}
