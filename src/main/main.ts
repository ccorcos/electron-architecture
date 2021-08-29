import { app, BrowserWindow } from "electron"
import { Config } from "./Config"
import { MainApp } from "./MainApp"
import { MainEnvironment } from "./MainEnvironment"
import { AppWindowPlugin } from "./plugins/AppWindowPlugin"
import { SystemMenuPlugin } from "./plugins/SystemMenuPlugin"

function setupConfig(): Config {
	const test = process.argv.slice(2).indexOf("--test") !== -1
	return { test }
}

/**
 * This harness doesn't do much currently.
 */
async function setupTestHarness(config: Config) {
	if (!config.test) return
	const { connectMainToTestHarness } = await import("../test/TestHarness")
	const harness = await connectMainToTestHarness()
	return harness
}

app.whenReady().then(async () => {
	const config = setupConfig()
	const harness = await setupTestHarness(config)
	const mainApp = new MainApp([AppWindowPlugin({ config }), SystemMenuPlugin])

	mainApp.onDispatch((action) => harness?.call.dispatchAction(action))

	const environment: MainEnvironment = { config, app: mainApp }

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
