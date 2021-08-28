/*

Inside the "Dispatch" menu are a bunch of tools for debugging.

*/

import { app, Menu } from "electron"
import { flatten } from "lodash"
import { MainAppPlugin } from "../MainApp"

export const SystemMenuPlugin: MainAppPlugin = (mainApp) => {
	function render() {
		const { windows } = mainApp.state

		const items = windows.map((win, i) => {
			return [
				{
					label: "Close Window " + i,
					click() {
						mainApp.dispatch.closeWindow(win.id)
					},
				},
				{
					label: "Move Window " + i,
					click() {
						mainApp.dispatch.moveWindow(win.id, {
							x: win.rect.x + 20,
							y: win.rect.y,
						})
					},
				},
				{
					label: "Resize Window " + i,
					click() {
						mainApp.dispatch.resizeWindow(win.id, {
							width: win.rect.width + 20,
							height: win.rect.height,
						})
					},
				},
				{
					label: "Focus Window " + i,
					click() {
						mainApp.dispatch.focusWindow(win.id)
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
							mainApp.dispatch.newWindow()
						},
					},
					...flatten(items),
				],
			},
		])
		Menu.setApplicationMenu(menu)
	}

	render()
	return {
		update() {
			render()
		},
		destroy() {},
	}
}
