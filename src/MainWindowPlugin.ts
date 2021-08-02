/*

This handles the "rendering" of BrowserWindows side-effect.

*/

import * as path from "path"
import { MainAppPlugin } from "./MainApp"
import { MainView } from "./MainView"
import { VirtualBrowserWindows } from "./VirtualBrowserWindow"

export const MainWindowPlugin: MainAppPlugin = (app) => {
	const virtual = MainView(app)
	const controller = new VirtualBrowserWindows(virtual, {
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			preload: path.join(__dirname, "preload.js"),
		},
		loadFile: path.join(__dirname, "../index.html"),
	})

	return {
		update() {
			controller.update(MainView(app))
		},
		destroy() {
			controller.destroy()
		},
	}
}
