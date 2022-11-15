import { WindowRect } from "./typeHelpers"

export const displayName = "Electron Architecture"

export type RendererConfig = {
	test?: { id: string; PORT: number }
	rect: WindowRect
}

export type MainConfig = {
	test?: {
		id: string
		MAIN_PORT: number
		RENDERER_PORT: number
		headless: boolean
	}
	partition: string
}
