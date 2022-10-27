import * as cpx from "cpx"
import { build as esbuild, BuildConfig } from "estrella"
import { hideBin } from "yargs/helpers"
import yargs from "yargs/yargs"

async function buildMainProcessSrc(watch = false) {
	const config: BuildConfig = {
		platform: "node",
		external: ["electron"],
		tsconfig: "tsconfig.json",
		bundle: true,
		sourcemap: watch ? "inline" : false,
		sourcesContent: watch,
		watch: watch,
		minify: !watch,
		clear: false,
	}

	await Promise.all([
		esbuild({
			...config,
			entry: "src/main/main.ts",
			outfile: "build/main.js",
		}),
		esbuild({
			...config,
			entry: "src/preload.ts",
			outfile: "build/preload.js",
		}),
	])
}

async function buildRendererProcessSrc(watch = false) {
	// TODO: Compile away config.test = false
	await esbuild({
		entry: "src/renderer/renderer.tsx",
		outfile: "build/renderer.js",
		tsconfig: "tsconfig.json",
		bundle: true,
		sourcemap: watch ? "inline" : false,
		sourcesContent: watch,
		watch: watch,
		minify: !watch,
		clear: false,
	})
}

async function buildFiles(watch = false) {
	if (watch) {
		cpx.watch("src/**/*.html", "build")
		cpx.watch("src/**/*.css", "build")
	} else {
		cpx.copySync("src/**/*.html", "build")
		cpx.copySync("src/**/*.css", "build")
	}
}

export async function buildSrc(watch = false) {
	await Promise.all([
		buildFiles(watch),
		buildRendererProcessSrc(watch),
		buildMainProcessSrc(watch),
	])
}

if (require.main === module) {
	async function main() {
		const { watch } = yargs(hideBin(process.argv)).options({
			watch: { type: "boolean", default: false },
		}).argv

		await buildSrc(watch)
	}

	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})
}
