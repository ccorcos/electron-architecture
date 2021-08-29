import { strict as assert } from "assert"
import { describe } from "mocha"
import { click, drag, shortcut, test } from "./testHelpers"

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

	test("Drag Window", async (harness) => {
		const window = harness.renderers[0]
		const { y, x, width } = window.state.rect
		const start = { x: x + width / 2, y: y + 10 }
		const end = { x: start.x + 300, y: start.y + 200 }
		await drag(start, end)

		await window.changedState()
		const newRect = window.state.rect
		assert.equal(newRect.y, y + 200)
		assert.equal(newRect.x, x + 300)
	})

	test("Resize Window", async (harness) => {
		const window = harness.renderers[0]
		const { y, x, width, height } = window.state.rect
		const start = { x: x + width, y: y + height }
		const end = { x: start.x + 300, y: start.y + 200 }
		await drag(start, end)
		await window.changedState()
		const newRect = window.state.rect
		assert.equal(newRect.y, y)
		assert.equal(newRect.x, x)
		assert.equal(newRect.height, height + 200)
		assert.equal(newRect.width, width + 300)
	})
})
