// ==================================================================
// Generic
// ==================================================================

export class App<S, A> {
	private effects: Effect<S>[]

	constructor(
		public state: S,
		private reducer: (state: S, action: A) => S,
		plugins: Plugin<S, A>[]
	) {
		this.effects = plugins.map((plugin) => plugin(this))
	}

	private running = false
	private actions: A[] = []
	dispatch(action: A) {
		this.actions.push(action)
		if (!this.running) {
			this.running = true
			this.flush()
		}
	}

	private flush() {
		if (this.actions.length === 0) {
			this.running = false
			return
		}
		const action = this.actions.shift()!
		const prevState = this.state
		this.state = this.reducer(prevState, action)
		for (const effect of this.effects) {
			effect.update(prevState)
		}
		this.flush()
	}

	destroy() {
		for (const effect of this.effects) {
			effect.destroy()
		}
	}
}

export type Plugin<S, A> = (app: App<S, A>) => Effect<S>

export type Effect<S> = {
	update(prevState: S): void
	destroy(): void
}

// ==================================================================
// Main
// ==================================================================

export interface MainAppState {}
export interface MainAppActions {}
export type MainAppAction = MainAppActions[keyof MainAppActions]
export type MainAppPlugin = Plugin<MainAppState, MainAppAction>
export class MainApp extends App<MainAppState, MainAppAction> {}

// ==================================================================
// Main
// ==================================================================

export interface RendererAppState {}
export interface RendererAppActions {}
export type RendererAppAction = RendererAppActions[keyof RendererAppActions]
export type RendererAppPlugin = Plugin<RendererAppState, RendererAppAction>
export class RendererApp extends App<RendererAppState, RendererAppAction> {}
