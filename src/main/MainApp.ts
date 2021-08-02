/*

This is the part the integrated the plugins and wires up the reducer loop.

*/

import { MainAction, mainInit, mainReducer, MainState } from "./MainState"
import { App, Plugin } from "../StateMachine"

export type MainAppPlugin = Plugin<MainState, MainAction>

export class MainApp extends App<MainState, MainAction> {
	constructor(plugins: MainAppPlugin[]) {
		super(mainInit(), mainReducer, plugins)
	}
}
