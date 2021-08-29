import { MainAction } from "../main/MainApp"
import { RendererAction } from "../renderer/RendererApp"
import {
	connectToTestHarness,
	createTestHarness,
	TestHarness,
} from "./TestHarness"

type Rect = { x: number; y: number; width: number; height: number }

type HarnessToRenderer = {
	measureDOM(cssSelector: string): Rect | undefined
}

type RendererToHarness = {
	dispatchAction(action: RendererAction): void
}

type HarnessToMain = {}

type MainToHarness = {
	dispatchAction(action: MainAction): void
}

export const MAIN_PORT = 1337
export const RENDERER_PORT = 1338

export class AppTestHarness extends TestHarness<
	HarnessToMain,
	MainToHarness,
	HarnessToRenderer,
	RendererToHarness
> {}

export function connectRendererToTestHarness() {
	return connectToTestHarness<RendererToHarness, HarnessToRenderer>(
		RENDERER_PORT
	)
}

export function connectMainToTestHarness() {
	return connectToTestHarness<MainToHarness, HarnessToMain>(MAIN_PORT)
}

export function createAppTestHarness() {
	return createTestHarness<
		HarnessToMain,
		MainToHarness,
		HarnessToRenderer,
		RendererToHarness
	>(MAIN_PORT, RENDERER_PORT)
}
