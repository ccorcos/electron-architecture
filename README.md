# Electron Architecture

Goals:
- state should be immutable and data-only.
- app should be the container for the state/dispatch loop.
- plugins should manage side-effects.
Non-goals:
- frontend architecture (see: [game counter](https://github.com/ccorcos/game-counter))

## Architecture

- src/main/main is the entry point for main.
	- MainState is the window state
	- MainApp is the actions/reducers for the state
	- AppWindowPlugin manages electron windows to be a fuction of state.
- src/renderer/renderer is the entry point for renderer.
	- RendererState basically mirrors the MainState for a specific window
	- SyncWindowRectPlugin will update the renderer state when its updated from main and vice versa.
- StateMachine and IPC uses proxies so that "Rename Symbol" and "Find All References" VSCode commands work well.

## TODO

- e2e testing frameworking
	- boot up the app
	- socket server apis
	- sync app state across
	- get position of button to click it
