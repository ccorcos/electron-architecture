import { app, BrowserWindow } from "electron"
import { MainApp } from "./MainApp"
import { AppWindowPlugin } from "./plugins/AppWindowPlugin"
import { SystemMenuPlugin } from "./plugins/SystemMenuPlugin"

const test = process.argv.slice(2).indexOf("--test") !== -1

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

async function setupTestHarness() {
	const { connectMainToTestHarness } = await import("../test/AppTestHarness")
	const harness = await connectMainToTestHarness()
	return harness
}

app.whenReady().then(async () => {
	const harness = test ? await setupTestHarness() : undefined

	const mainApp = new MainApp([AppWindowPlugin, SystemMenuPlugin])

	mainApp.onDispatch((action) => {
		harness?.call.dispatchAction(action)
	})

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			mainApp.dispatch.newWindow()
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
