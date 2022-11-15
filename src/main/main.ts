import { app, BrowserWindow } from "electron"
import { MainConfig } from "../shared/Config"
import { createConfig } from "../shared/createConfig"
import { MainApp } from "./MainApp"
import { MainEnvironment } from "./MainEnvironment"
import { AppWindowPlugin } from "./plugins/AppWindowPlugin"
import { SystemMenuPlugin } from "./plugins/SystemMenuPlugin"

async function setupTestHarness(config: MainConfig) {
	if (!config.test) return
	const { connectMainToTestHarness } = await import(
		"../test/harness/MainTestHarnessClient"
	)
	const harness = await connectMainToTestHarness(config.test.MAIN_PORT)
	return harness
}

app.whenReady().then(async () => {
	const config = createConfig()
	const harness = await setupTestHarness(config)
	const mainApp = new MainApp()
	mainApp.onDispatch((action) => harness?.call.dispatchAction(action))
	const environment: MainEnvironment = { config, app: mainApp }

	// Plug effects
	mainApp.plug(SystemMenuPlugin(mainApp))
	mainApp.plug(AppWindowPlugin(environment))

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			mainApp.dispatch.newWindow()
		}
	})

	if (harness && config.test?.id) {
		harness?.call.ready(config.test.id)
	}
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
