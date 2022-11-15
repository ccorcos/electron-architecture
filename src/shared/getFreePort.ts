import { isString } from "lodash"
import net from "net"
import { DeferredPromise } from "./DeferredPromise"

/**
 * Obtain an free port number to use for a server
 */
export function getFreePort(): Promise<number> {
	const server = net.createServer()
	const deferred = new DeferredPromise<number>()

	server.on("listening", () => {
		const address = server.address()
		if (!address || isString(address)) {
			server.close()
			deferred.reject(new Error(`Server address was in an unexpected format.`))
			return
		}

		const port = address.port
		server.close()
		deferred.resolve(port)
	})

	server.on("error", (err) => {
		deferred.reject(err)
		server.close()
	})

	server.listen(0, "127.0.0.1")

	return deferred.promise
}
