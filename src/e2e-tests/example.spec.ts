import { strict as assert } from "assert"
import { e2eTest } from "../test/e2eTest"

e2eTest("Title is visible", async ({ h }) => {
	const w = h.window(0)
	const title = w.locate("h1")

	assert(await title.isVisible())
})

e2eTest("Increment", async ({ h }) => {
	const w = h.window(0)

	const button = w.locate("button", { hasText: "increment" })
	await button.click()

	const span = w.locate("span")
	const text = await span.innerText()

	assert.equal(text, "1")
})

e2eTest("Decrement", async ({ h }) => {
	const w = h.window(0)

	const button = w.locate("button", { hasText: "decrement" })
	await button.click()

	const span = w.locate("span")
	const text = await span.innerText()

	assert.equal(text, "-1")
})

e2eTest("Increment then Decrement", async ({ h }) => {
	const w = h.window(0)

	const increment = w.locate("button", { hasText: "increment" })
	await increment.click()

	const decrement = w.locate("button", { hasText: "decrement" })
	await decrement.click()

	const span = w.locate("span")
	const text = await span.innerText()

	assert.equal(text, "0")
})
