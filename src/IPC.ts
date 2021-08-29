// TODO: don't extends this interface...

import { WindowRect } from "./main/MainState"

export type RendererToMainIPC = {
	load(): { test: boolean; rect: WindowRect }
	setPosition(args: { x: number; y: number }): void
	setSize(args: { height: number; width: number }): void
}

export type MainToRendererIPC = {
	updatePosition(args: { x: number; y: number }): void
	updateSize(args: { height: number; width: number }): void
}
