import { app, BrowserWindow } from "electron"
import yargs from "yargs"
import { Config } from "./Config"
import { MainApp } from "./MainApp"
import { MainEnvironment } from "./MainEnvironment"
import { AppWindowPlugin } from "./plugins/AppWindowPlugin"
import { SystemMenuPlugin } from "./plugins/SystemMenuPlugin"

function setupConfig(): Config {
	const { test, partition, headless } = yargs(process.argv)
		.options({
			test: { type: "boolean", default: false },
			partition: { type: "string", default: app.getPath("appData") },
			headless: { type: "boolean", default: false },
		})
		.parseSync()

	const config: Config = { test, partition, headless }
	console.log({ config })

	return config
}

async function setupTestHarness(config: Config) {
	if (!config.test) return
	const { connectMainToTestHarness } = await import(
		"../test/harness/MainTestHarnessClient"
	)
	const harness = await connectMainToTestHarness()
	return harness
}

app.whenReady().then(async () => {
	const config = setupConfig()
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

	harness?.call.ready()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
