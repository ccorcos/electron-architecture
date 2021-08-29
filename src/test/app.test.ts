import { strict as assert } from "assert"
import { describe } from "mocha"
import { click, test } from "./testHelpers"

describe("App", function () {
	this.timeout(100000)

	test("Starts up.", (harness) => {
		assert.equal(harness.renderers.length, 1)
	})

	// The confusing part about this abstraction: inspecting multiple sources of truth.
	test("Move Window Button", async (harness) => {
		const window = harness.renderers[0]
		// const posX = window.state.position.x

		await click(window, "button")
	})

	test("New Window", async (harness) => {
		// assert.ok(window.state.position.x !== posX)
		// TODO:
		//
		// MetaKey is Super.
		// await nut.keyboard.pressKey(nut.Key.LeftSuper, nut.Key.N)
		// await nut.keyboard.releaseKey(nut.Key.LeftSuper, nut.Key.N)
		// await sleep(500)
		//
		// assert.equal(harness.renderers.length, 2)
	})

	test("DragWindow", async (harness) => {})

	test("ResizeWindow", async (harness) => {})
})
