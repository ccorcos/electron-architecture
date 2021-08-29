import * as nut from "@nut-tree/nut-js"
import { strict as assert } from "assert"
import * as child_process from "child_process"
import { it } from "mocha"
import { DeferredPromise } from "../shared/DeferredPromise"
import { rootPath } from "../tools/rootPath"
import { RendererHarness, TestHarness } from "./TestHarness"

nut.keyboard.config.autoDelayMs = 100
nut.mouse.config.autoDelayMs = 100
nut.mouse.config.mouseSpeed = 1000

async function bootup(cliArgs: string[] = []) {
	const harness = await TestHarness.create()

	// Run the app.
	const cwd = rootPath(".")
	const cmd = rootPath("node_modules/.bin/electron")
	const args = [rootPath("build/main/main.js"), "--test", ...cliArgs]

	const child = child_process.spawn(cmd, args, {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	})

	const deferred = new DeferredPromise()

	// Kill the child process when the main process exits.
	const onExit = () => child.kill()
	process.on("exit", onExit)

	child.on("error", (err) => {
		process.off("exit", onExit)
		deferred.reject(err)
	})

	child.on("exit", (code, signal) => {
		process.off("exit", onExit)
		if (code !== 0) {
			deferred.reject(
				new Error(`Unexpected exit code ${code}. "${cmd} ${args.join(" ")}"`)
			)
		} else {
			deferred.resolve()
		}
	})

	// Monkey-patch destroy. Pretty gross...
	const destory = harness.destroy
	harness.destroy = async () => {
		await destory()
		child.kill("SIGINT")
		await deferred.promise
	}

	await harness.waitUntilReady()

	return harness
}

export function test(
	testName: string,
	fn: (harness: TestHarness) => void | Promise<void>
) {
	return it(testName, async () => {
		const harness = await bootup()
		try {
			await fn(harness)
		} catch (error) {
			throw error
		} finally {
			await harness.destroy()
		}
	})
}

export async function measureDOM(
	renderer: RendererHarness,
	cssSelector: string
) {
	const rect = await renderer.call.measureDOM(cssSelector)
	assert.ok(rect)
	return rect
}

export async function type(str: string) {
	await nut.keyboard.type(str)
}

const keyboardAliases: Record<string, number | undefined> = {
	ctrl: nut.Key.LeftControl,
	control: nut.Key.LeftControl,
	mod: nut.Key.LeftSuper,
	meta: nut.Key.LeftSuper,
	cmd: nut.Key.LeftSuper,
	" ": nut.Key.Space,
	left: nut.Key.Left,
	right: nut.Key.Right,
	down: nut.Key.Down,
	up: nut.Key.Up,
}

function getNormalizedKeys(shortcut: string) {
	return shortcut
		.split(/-(?!$)/)
		.map((str) => str.toLowerCase())
		.map((char) => {
			const alias = keyboardAliases[char]
			if (alias !== undefined) return alias
			const keyNum: number | undefined = nut.Key[
				char.toUpperCase() as any
			] as any
			if (keyNum === undefined) throw new Error("Unknown key: " + char)
			return keyNum
		})
}

export async function shortcut(str: string) {
	const parts = getNormalizedKeys(str)
	await nut.keyboard.pressKey(...parts)
	await nut.keyboard.releaseKey(...parts)
}

export async function click(renderer: RendererHarness, cssSelector: string) {
	const rect = await measureDOM(renderer, cssSelector)
	await nut.mouse.move([
		{
			x: rect.x + rect.width / 2,
			y: rect.y + rect.height / 2,
		},
	])

	await sleep(50)

	await nut.mouse.leftClick()
}

export function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type Point = { x: number; y: number }

export async function drag(from: Point, to: Point) {
	await nut.mouse.move([from])
	await sleep(50)
	await nut.mouse.pressButton(nut.Button.LEFT)
	await sleep(50)
	await nut.mouse.move([to])
	await sleep(50)
	await nut.mouse.releaseButton(nut.Button.LEFT)
}
