import os from "os"
import outdent from "outdent"
import path from "path"
import yargs from "yargs"
import { displayName, MainConfig } from "./Config"

export function createConfig(): MainConfig {
	const args = yargs(process.argv)
		.options({
			test: { type: "boolean", default: false },
			testId: { type: "string" },
			headless: { type: "boolean" },
			MAIN_PORT: { type: "number" },
			RENDERER_PORT: { type: "number" },
			partition: { type: "string" },
		})
		.parseSync()

	const { test, partition = defaultAppDataDir() } = args

	let testData: MainConfig["test"]

	if (test) {
		const { testId, headless, MAIN_PORT, RENDERER_PORT } = args

		if (
			testId === undefined ||
			headless === undefined ||
			MAIN_PORT === undefined ||
			RENDERER_PORT === undefined
		) {
			throw new Error(
				outdent`
          Malformed cli args: test option was set,
          expected testId, headless, MAIN_PORT and RENDERER_PORT to be set
        `
			)
		}

		testData = {
			id: testId,
			headless,
			MAIN_PORT,
			RENDERER_PORT,
		}
	}

	const config: MainConfig = {
		test: testData,
		partition: path.resolve(partition),
	}

	console.log("config:", config)
	return config
}

export function makeAppCliArgs(config: Partial<MainConfig>) {
	const { test, partition } = config

	const args: string[] = []

	if (test) {
		const { id, MAIN_PORT, RENDERER_PORT, headless } = test
		args.push(`--test`)
		args.push(`--testId=${id}`)
		args.push(`--MAIN_PORT=${MAIN_PORT}`)
		args.push(`--RENDERER_PORT=${RENDERER_PORT}`)
		args.push(`--headless=${headless}`)
	}

	if (partition) args.push(`--partition=${partition}`)

	return args
}

function defaultAppDataDir() {
	// Its important that we don't use `electron.app.getPath("appData")` and
	// `electron.app.getName()` because we want to be able to know this even
	// when electron isn't running so that we can edit the indexes from a CLI.

	// The rest of this program is just recreating the following one-liner. :(
	// return path.join(app.getPath("appData"), app.getName())

	// As per documention:
	// https://www.electronjs.org/docs/v14-x-y/api/app#appgetpathname
	// appData Per-user application data directory, which by default points to:
	// 		%APPDATA% on Windows
	// 		$XDG_CONFIG_HOME or ~/.config on Linux
	// 		~/Library/Application Support on macOS

	const platform = os.platform()
	const homeDir = os.homedir()

	let baseDir: string
	if (platform === "darwin")
		baseDir = path.join(homeDir, "Library", "Application Support")
	else throw new Error("Unsupported operating system: " + platform)

	return path.join(baseDir, displayName)
}
