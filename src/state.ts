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

	dispatch(action: A) {
		const prevState = this.state
		this.state = this.reducer(prevState, action)
		for (const effect of this.effects) {
			effect.update(prevState)
		}
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
