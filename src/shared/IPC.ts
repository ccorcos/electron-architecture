// TODO: don't extends this interface...

import { WindowRect } from "../main/MainState"
import { AsyncApi } from "./typeHelpers"

export const ipcChannel = "ipc-channel"

export type RendererToMainIPC = AsyncApi<{
	load(): { test: boolean; rect: WindowRect }
	setPosition(args: { x: number; y: number }): void
	setSize(args: { height: number; width: number }): void
}>

export type MainToRendererIPC = AsyncApi<{
	updatePosition(args: { x: number; y: number }): void
	updateSize(args: { height: number; width: number }): void
}>
