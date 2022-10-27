import * as cpx from "cpx"
import { build as esbuild, BuildConfig, cliopts } from "estrella"

async function buildMainProcessSrc(opts: BuildSrcOptions) {
	const { watch, dev } = opts
	const config: BuildConfig = {
		platform: "node",
		external: ["electron"],
		tsconfig: "tsconfig.json",
		bundle: true,
		sourcemap: dev ? "inline" : false,
		sourcesContent: dev,
		watch: watch,
		minify: !dev,
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

async function buildRendererProcessSrc(opts: BuildSrcOptions) {
	const { watch, dev } = opts
	// TODO: Compile away config.test = false
	await esbuild({
		entry: "src/renderer/renderer.tsx",
		outfile: "build/renderer.js",
		tsconfig: "tsconfig.json",
		bundle: true,
		sourcemap: dev ? "inline" : false,
		sourcesContent: dev,
		watch: watch,
		minify: !dev,
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

type BuildSrcOptions = {
	watch: boolean
	dev: boolean
}

export async function buildSrc(opts: BuildSrcOptions) {
	await Promise.all([
		buildFiles(opts.watch),
		buildRendererProcessSrc(opts),
		buildMainProcessSrc(opts),
	])
}

if (require.main === module) {
	async function main() {
		const [{ dev }] = cliopts.parse(["dev", "Debug build"])

		await buildSrc({ dev, watch: false })
	}

	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})
}
