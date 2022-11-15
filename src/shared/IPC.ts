// TODO: don't extends this interface...

import { RendererConfig } from "./Config"
import { AsyncApi } from "./typeHelpers"

export const ipcChannel = "ipc-channel"

export type RendererToMainIPC = AsyncApi<{
	load(): RendererConfig
	setPosition(args: { x: number; y: number }): void
	setSize(args: { height: number; width: number }): void
}>

export type MainToRendererIPC = AsyncApi<{
	updatePosition(args: { x: number; y: number }): void
	updateSize(args: { height: number; width: number }): void
}>
