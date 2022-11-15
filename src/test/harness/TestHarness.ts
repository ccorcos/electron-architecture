import { IPCPeer } from "../../shared/IPCPeer"
import { AnyFunctionMap } from "../../shared/typeHelpers"

type Listener = (message: any) => void
type Unsubscribe = () => void

export type TestHarnessSocketApi = {
	onMessage: (listener: Listener) => Unsubscribe
	onClose: (fn: () => void) => Unsubscribe
	send: (message: any) => Promise<void>
	destroy: () => void
}

/**
 * This class wraps the TestHarnessSocket into an IPCPeer so we have a typed interface.
 */
export class TestHarnessIpc<
	C extends AnyFunctionMap,
	A extends AnyFunctionMap
> extends IPCPeer<C, A> {
	constructor(private socket: TestHarnessSocketApi) {
		super({
			send: (message) => {
				socket.send(message)
			},
			listen: (callback) => {
				return socket.onMessage(callback)
			},
		})
	}

	destroy() {
		super.destroy()
		this.socket.destroy()
	}

	onClose(fn: () => void) {
		this.socket.onClose(fn)
	}
}
