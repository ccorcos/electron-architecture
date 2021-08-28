/*

Inside the "Dispatch" menu are a bunch of tools for debugging.

*/

import { app, Menu } from "electron"
import { flatten } from "lodash"
import { MainAppPlugin } from "./MainApp"

export const SystemMenuPlugin: MainAppPlugin = (mainApp) => {
	return {
		update() {
			const { windows } = mainApp.state

			const items = windows.map((win, i) => {
				return [
					{
						label: "Close Window " + i,
						click() {
							mainApp.dispatch({ type: "closeWindow", id: win.id })
						},
					},
					{
						label: "Move Window " + i,
						click() {
							mainApp.dispatch({
								type: "moveWindow",
								id: win.id,
								x: win.rect.x + 20,
								y: win.rect.y,
							})
						},
					},
					{
						label: "Resize Window " + i,
						click() {
							mainApp.dispatch({
								type: "resizeWindow",
								id: win.id,
								width: win.rect.width + 20,
								height: win.rect.height,
							})
						},
					},
					{
						label: "Focus Window " + i,
						click() {
							mainApp.dispatch({
								type: "focusWindow",
								id: win.id,
							})
						},
					},
				]
			})

			const menu = Menu.buildFromTemplate([
				{
					label: app.name,
					submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
				},
				{
					label: "File",
					submenu: [{ role: "close" }],
				},
				{
					label: "Dispatch",
					submenu: [
						{
							label: "New Window",
							click() {
								mainApp.dispatch({ type: "newWindow" })
							},
						},
						...flatten(items),
					],
				},
			])
			Menu.setApplicationMenu(menu)
		},
		destroy() {},
	}
}
