import { app, BrowserWindow } from "electron"
import {
	initMainState,
	updateMainState,
	organizeWindows,
	ElectronWindowPlugin,
	SystemMenuPlugin,
} from "./MainApp"
import { MainApp } from "./state"

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.on("ready", () => {
	const mainApp = new MainApp(
		initMainState(),
		(state, action) => {
			const nextState = organizeWindows(updateMainState(state, action))
			console.log("ACTION", action)
			console.log("STATE", nextState)
			return nextState
		},
		[ElectronWindowPlugin, SystemMenuPlugin]
	)

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			mainApp.dispatch({ type: "new-window" })
		}
	})
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
