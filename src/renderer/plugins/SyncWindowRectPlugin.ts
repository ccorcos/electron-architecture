import { RendererApp, RendererAppPlugin } from "../RendererApp"
import { answerMain, callMain } from "../RendererIPC"
import { RendererState } from "../RendererState"

export const SyncWindowRectPlugin: RendererAppPlugin = (app) => {
	return new SyncWindowRectController(app)
}

/**
 * Updates the local state to match the main process state.
 */
class SyncWindowRectController {
	private listeners: (() => void)[] = []

	constructor(private app: RendererApp) {
		this.listeners.push(
			answerMain.updatePosition(({ x, y }) => {
				app.dispatch.moveWindow({ x, y })
			})
		)
		this.listeners.push(
			answerMain.updateSize(({ height, width }) => {
				app.dispatch.resizeWindow({ height, width })
			})
		)
	}

	update(prevState: RendererState) {
		const nextState = this.app.state
		if (nextState === prevState) return
		if (nextState.rect === prevState.rect) return

		const nextRect = nextState.rect
		const prevRect = prevState.rect

		if (nextRect.x !== prevRect.x || nextRect.y !== prevRect.y) {
			callMain.setPosition(nextRect)
		}

		if (
			nextRect.width !== prevRect.width ||
			nextRect.height !== prevRect.height
		) {
			callMain.setSize(nextRect)
		}
	}

	destroy() {
		this.listeners.forEach((fn) => fn())
	}
}
