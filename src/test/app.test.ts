import { strict as assert } from "assert"
import { describe } from "mocha"
import { click, shortcut, test } from "./testHelpers"

describe("App", function () {
	this.timeout(100000)

	test("Starts up.", (harness) => {
		assert.equal(harness.renderers.length, 1)
	})

	// The confusing part about this abstraction: inspecting multiple sources of truth.
	test("Move Window Button", async (harness) => {
		const window = harness.renderers[0]
		const posX = window.state.rect.x
		await click(window, "button")
		await window.changedState()
		assert.notEqual(window.state.rect.x, posX)
	})

	test("New Window", async (harness) => {
		await shortcut("Meta-N")
		await Promise.all([harness.main.changedState(), harness.changedState()])
		assert.equal(harness.main.state.windows.length, 2)
		assert.equal(harness.renderers.length, 2)
	})

	test("DragWindow", async (harness) => {})

	test("ResizeWindow", async (harness) => {})
})
