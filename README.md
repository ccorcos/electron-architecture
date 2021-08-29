# Electron Architecture

This project is a boilerplate electron app with a thoughtfully designed architecture:

1. Main and renderer processes manage state using a Redux-like state machine.
2. Electron BrowserWindows are controlled declaratively through the application state.
3. Electron IPC uses a Proxy enabling "Rename Symbol" and "Find All References" in VSCode.
4. A TestHarness for end-to-end tests with the ability to call into the main and renderer process and make assertions about the main and renderer process states.

## Architecture

### What is a StateMachine?

First, you need to understand the StateMachine abstraction.

```ts
// State and reducers are much like Redux.
type CounterState = {count: number}

type counterReducers = {
	increment(state: CounterState, n: number) {
		return {count: state.count + n}
	}
}

// Actions are "defunctionalized" calls to counterReducers.
type CounterActions = Actions<typeof counterReducers>

// Call app.dispatch[action]() to update app.state.
class CounterApp extends StateMachine<CounterState, typeof counterReducers> {
	construtor() {
		super({count: 0}, counterReducers, [RenderCounterPlugin])
	}
}

// This is the side-effect that handles rendering the counter.
function RenderCounterPlugin(app: CounterApp) {
	document.getElementById("count").innerText = app.state.count.toString()

	document
		.getElementById("increment")
		.addEventListener("click", () => app.dispatch.increment(1))

	document
		.getElementById("decrement")
		.addEventListener("click", () => app.dispatch.increment(-1))

	return {
		update() {
			document.getElementById("count").innerText = app.state.count.toString()
		},
		destroy() {}
	}
}

// All you need to boot it up.
const app = new CounterApp()
```

A couple novel things about this StateMachine:
- app.dispatch uses a Proxy so that cmd+click on an action takes you to the reducer in VSCode.
- using some type magic, we never have to define action types or wire all the reducers together manually.

### What is the AppWindowPlugin?

The AppWindowPlugin is a nifty plugin for managing electron BrowserWindows. Its is implemented as a StateMachine EffectPlugin which means that we can simply update the state of the application and the plugin will do whatever it has to do to make the BrowserWindows comply. Think of this as React for Electron where the app state is the virtual window specification.


```ts
// Creating a new electron window is as simple as:
// (1) dispatch the appropriate action.
mainApp.dispatch.newWindow()

// (2) update the app state with a new window
function newWindow(state: MainState): MainState {
	const { windows } = state
	const focused = windows[0]

	const newWindow: WindowState = {
		id: randomId(),
		focused: true,
		rect: focused ? getOffsetRect(focused.rect) : initRect(),
	}

	return {
		...state,
		windows: [newWindow, ...unfocusWindows(windows)],
	}
}

// (3) let the AppWindowPlugin do the hard work for you.
class AppWindow {
	// ...
	updateState(nextState: WindowState) {
		const prevState = this.windowState
		if (prevState === nextState) return
		this.windowState = nextState

		if (nextState.focused && !this.browserWindow.isFocused()) {
			this.browserWindow.focus()
		}

		if (prevState.rect === nextState.rect) return

		const prevRect = prevState.rect
		const nextRect = nextState.rect

		if (prevRect.x !== nextRect.x || prevRect.y !== nextRect.y) {
			this.browserWindow.setPosition(nextRect.x, nextRect.y, false)
			callRenderer.updatePosition(this.browserWindow, nextRect)
		}
		// ...
	}
	// ...
}
```

### How does Electron IPC work?

The renderer and main process communicate over IPC using an interface defined in [`IPC.ts`](./src/IPC.ts). To call these methods:

- From the renderer process, use `callMain` and `answerMain` from [`RendererIPC.ts`](src/renderer/RendererIPC.ts).
- From the main process, use `callRenderer` and `answerRenderer` from [`MainIPC.ts`](src/main/MainIPC.ts).

We're using a Proxy trick here once again making it easier to "Rename Symbol" and "Find All References" in VSCode.

```ts

// Renderer API for alling into the main process.
type RendererToMainIPC = {
	newWindow(): void
}

// Main API for calling into the renderer process.
type MainToRendererIPC = {
	saveState(): RendererState
}

// From the renderer process.
await callMain.newWindow()
answerMain.saveState(() => rendererApp.state)

// From the main process.
const state = await callRenderer.saveState(browserWindow)
answerRenderer.newWindow(() => mainApp.dispatch.newWindow())
```

### Getting around

- [`main.ts`](./src/main/main.ts) is the entry point for main process.
- [`MainState.ts`](./src/main/MainState.ts)
- [`MainApp.ts`](./src/main/MainApp.ts) has all the reducers/actions.
- [`renderer.ts`](./src/renderer/renderer.ts) is the entry point for renderer process.
- [`RendererState.ts`](./src/renderer/RendererState.ts)
- [`RendererApp.ts`](./src/renderer/RendererApp.ts) has all the reducers/actions.

### How does this demo app work?

The main process is a state machine that controls the window positions and sizes.

The main process dispatches position updates to the renderer process.

The renderer process displays the position. It also uses the `SyncWindowRectPlugin.ts` so that updates to the renderer state are propagated to the main process.

It's a little bit contrived, but it also a state machine in each process and IPC going in both directions.

### How does TestHarness work?

The TestHarness hooks into the application making it easier to write tests. It opens up a TCP server, and both the main process and renderer processes connect to this TCP server.

At the top of [`TestHarness.ts`](./src/test/TestHarness.ts), you will see the API type definitions. The test harness works very similar to Electron IPC, only these methods are used just testing.

```ts
type HarnessToRenderer = {
	measureDOM(cssSelector: string): Rect | undefined
	getState(): RendererState
}

type RendererToHarness = {
	dispatchAction(action: RendererAction): void
}

type HarnessToMain = {}

type MainToHarness = {
	dispatchAction(action: MainAction): void
}
```

When you create a `test` from `testHelpers.ts`, we boot up the electron app using `child_process.spawn`. No more Selenium or Spectron (they were a pain to work with). The test is called with the `TestHarness` as the first argument.

- `harness.main.call` lets you call into the main process.
- `harness.main.answer` lets the main process call into the test process.
- `harness.renderers` is a list of renderer processes.
- `harness.renderers[0].call` lets the test process call into the renderer process.
- `harness.renderers[0].answer` lets the renderer process call into the test process.

```ts
test("Name of the test", async (harness) => {
	const renderer = harness.renderers[0]
	const rect = await renderer.measureDOM("button")
})
```

The test harness also listens for state changes from each process so that you can make assertions about them.

```ts
test("Move Window Button", async (harness) => {
	// Assertion about the harness and it's TCP connections.
	assert.equal(harness.renderers.length, 1)
	// Assertion about the state of the main process.
	assert.equal(harness.main.state.windows.length, 1)

	const renderer = harness.renderers[0]

	// Move the window by clicking the move button.
	const initialPosX = renderer.state.rect.x
	await click(renderer, "button")
	await renderer.changedState() // Wait for that click to propagate.
	const finalPosX = renderer.state.rect.x

	// Assertion about the state inside the renderer process.
	assert.notEqual(finalPosX, initialPosX)
})
```

We're using `nut.js` under the hood for all the mouse and keyboard automation so there's no virtual events to worry about. You can do things like drag the browser window around which is not possible Selenium or Spectron.

Also, did I mention that these tests are much faster than Selenium?

```
  App
    ✓ Starts up. (1165ms)
    ✓ Move Window Button (1012ms)
    ✓ New Window (1495ms)
    ✓ Drag Window (1005ms)
    ✓ Resize Window (1028ms)
```

It's not light speed, but still pretty quick for an e2e test that boots up the app and moves windows around!

### What's left?

My focus so far has been mostly on Electron IPC, StateMachine, and TestHarness. Currently, the actual frontend of the application is incredibly simple. My [Game Counter](https://github.com/ccorcos/game-counter) project does a good job of demonstrating a good frontend architecture that still uses a StateMachine but also setup up an *environment* that gets plumbed around for managing side-effects.

