# Electron Architecture

Goals:
- state should be immutable and data-only.
- app should be the container for the state/dispatch loop.
- plugins should implement and manage the side-effects.

Here we've demonstrated a basic state machine architecture with all side-effects implemented as plugins.

```ts
class App<State, Action> {
	state: State
	dispatch(action: Action): void

	constructor(
		initialState: State,
		reducer: (state: State, action: Action) => State,
		plugins: Plugin<State,Action>[]
	)
}

type Plugin<State, Action> = (app: App<State, Action>) => Effect<State>

type Effect<State> = {
	update(prevState: State): void
	destroy(): void
}
```

As an additional level of complexity, we can make effect declarative by using an intermediate data-structure for diffing, similar to React's virtual DOM. In the meantime, we simply have to manually update side-effect in response to changes in the app state.

## TODO
- proper focus in app window state.

- bring in the Game Counter architecture
	- state machine
	- ipc
	- better naming

- e2e testing frameworking
