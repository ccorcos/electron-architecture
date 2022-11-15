import {
	ElectronApplication,
	Locator,
	test as baseTest,
} from "@playwright/test"
import fs from "fs-extra"
import { _electron as electron } from "playwright"
import { MainConfig } from "../shared/Config"
import { makeAppCliArgs } from "../shared/createConfig"
import { getFreePort } from "../shared/getFreePort"
import { rootPath } from "../shared/rootPath"
import { tmpDir } from "../shared/utils"
import { TestHarnessServer } from "./harness/TestHarnessServer"

type E2EWorkerFixture = {
	MAIN_PORT: number
	RENDERER_PORT: number
	harness: TestHarnessServer
}

type E2ETestFixture = {
	testId: string
	app: ElectronApplication
	partition: string
	h: ReturnType<typeof e2eDialect>
}

/**
 * https://playwright.dev/docs/test-fixtures#creating-a-fixture
 */
export const e2eTest = baseTest.extend<E2ETestFixture, E2EWorkerFixture>({
	MAIN_PORT: [
		async ({}, use) => {
			const port = await getFreePort()
			await use(port)
		},
		{ scope: "worker", auto: true },
	],
	RENDERER_PORT: [
		async ({}, use) => {
			const port = await getFreePort()
			await use(port)
		},
		{ scope: "worker", auto: true },
	],
	harness: [
		async ({ MAIN_PORT, RENDERER_PORT }, use) => {
			const harness = await TestHarnessServer.create(MAIN_PORT, RENDERER_PORT)

			await use(harness)

			await harness.destroy()
		},
		{ scope: "worker", auto: true },
	],
	partition: async ({}, use) => {
		const partition = tmpDir()
		await fs.mkdirp(partition)

		await use(partition)

		// Should we delete partition? Maybe only if it was success?
	},
	testId: async ({}, use, testInfo) => {
		// This *should* be a unique test id - playwright throws an error
		// if it sees identically named tests
		use(testInfo.titlePath.join("-"))
	},
	app: async (
		{ harness, testId, partition, MAIN_PORT, RENDERER_PORT },
		use,
		testInfo
	) => {
		harness.dispatch.mountTest(testId)
		// Run head-full if the test has a .only annotation
		// Not the ideal way to do this, but works for now?
		// https://github.com/microsoft/playwright/issues/18363
		const isDebug =
			(testInfo as any)._test._only || Boolean(process.env.PWDEBUG)

		const config: Partial<MainConfig> = {
			test: {
				headless: !isDebug,
				id: testId,
				MAIN_PORT,
				RENDERER_PORT,
			},
			partition,
		}

		const args = [rootPath("build/main.js"), ...makeAppCliArgs(config)]

		const electronApp = await electron.launch({ args })

		await electronApp.firstWindow()
		await harness.waitUntilTestIsReady(testId)

		// Use the fixture value in the test.
		await use(electronApp)

		// Clean up the fixture.
		await electronApp.close()
		harness.dispatch.unmountTest(testId)
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
