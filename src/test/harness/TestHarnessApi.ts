import { MainAction } from "../../main/MainApp"
import { RendererAction } from "../../renderer/RendererApp"
import { RendererState } from "../../renderer/RendererState"
import { Rect } from "../../shared/typeHelpers"

export type HarnessToRenderer = {
	measureDOM(cssSelector: string): Rect | undefined
	getState(): RendererState
}

export type RendererToHarness = {
	dispatchAction(action: RendererAction): void
}

export type HarnessToMain = {}

export type MainToHarness = {
	dispatchAction(action: MainAction): void
}
