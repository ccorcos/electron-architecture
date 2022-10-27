import { rootPath } from "./rootPath"

export function randomId() {
	return Math.random().toString().slice(3, 13)
}

export function tmpDir() {
	const random = Date.now().toString() + "-" + randomId()
	return rootPath(`tmp/${random}`)
}
