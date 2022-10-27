import * as path from "path"

export function rootPath(...args: Array<string>) {
	return path.join(__dirname, "../..", ...args)
}
