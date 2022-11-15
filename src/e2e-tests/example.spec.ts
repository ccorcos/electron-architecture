import { expect } from "@playwright/test"
import { e2eTest } from "../test/e2eTest"

e2eTest("Title is visible", async ({ h }) => {
	const w = h.window(0)
	const title = w.locate("h1")

	await expect(title).toBeVisible()
})

e2eTest("Increment button is visible", async ({ h }) => {
	const w = h.window(0)
	const increment = w.locate("button", { hasText: "increment" })

	await expect(increment).toBeVisible()
})

e2eTest("Decrement button is visible", async ({ h }) => {
	const w = h.window(0)
	const decrement = w.locate("button", { hasText: "decrement" })

	await expect(decrement).toBeVisible()
})
