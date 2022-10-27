import {
	ElectronApplication,
	Locator,
	test as baseTest,
} from "@playwright/test"
import fs from "fs-extra"
import { _electron as electron } from "playwright"
import { rootPath } from "../shared/rootPath"
import { isTruthy } from "../shared/typeHelpers"
import { tmpDir } from "../shared/utils"
import { TestHarnessServer } from "./harness/TestHarnessServer"

type ElectronE2ETestFixture = {
	app: ElectronApplication
	h: ReturnType<typeof e2eDialect>
}

/**
 * https://playwright.dev/docs/test-fixtures#creating-a-fixture
 */
export const e2eTest = baseTest.extend<ElectronE2ETestFixture>({
	app: async ({}, use, testInfo) => {
		// Set up the fixture.
		const partition = tmpDir()
		await fs.mkdirp(partition)

		const server = await TestHarnessServer.create(partition)

		// Run head-full if the test has a .only annotation
		// Not the ideal way to do this, but works for now?
		// https://github.com/microsoft/playwright/issues/18363
		const isOnly = !(testInfo as any)._test._only

		const args = [
			rootPath("build/main.js"),
			"--test",
			"--partition=" + partition,
			!isOnly && "--headless",
		].filter(isTruthy)

		const electronApp = await electron.launch({ args })

		await electronApp.firstWindow()
		await server.waitUntilReady()

		// Use the fixture value in the test.
		await use(electronApp)

		// Clean up the fixture.
		await electronApp.close()
		await server.destroy()
	},
	h: async ({ app }, use) => {
		const dialect = e2eDialect(app)
		await use(dialect)
	},
})

export function e2eDialect(app: ElectronApplication) {
	async function sleep(timeMs: number) {
		await new Promise((resolve) => {
			setTimeout(resolve, timeMs)
		})
	}

	return {
		sleep,
		window: (index: number) => {
			const page = app.windows()[index]
			if (!page) throw new Error(`No window at index ${index} found.`)

			return {
				locate: (
					selector: string,
					options?: {
						has?: Locator
						hasText?: string | RegExp
					}
				) => page.locator(selector, options),
			}
		},
	}
}
