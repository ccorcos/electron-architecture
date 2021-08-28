export class DeferredPromise<T = void> {
	resolve!: (value: T) => void
	reject!: (error: any) => void
	promise: Promise<T>
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}
