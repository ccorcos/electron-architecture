/*

This is meant to be similar to React, allowing for a declarative specification
of the windows and their state.

*/

import { BrowserWindow, IpcRendererEvent } from "electron"
import { differenceBy, intersectionBy } from "lodash"

export type BrowserWindowProps = {
	id: string
	focused: boolean
	x: number
	y: number
	width: number
	height: number
	onClose?(): void
	onClosed?(): void
	onMove?(args: { x: number; y: number }): void
	onMoved?(args: { x: number; y: number }): void
	onResize?(args: { height: number; width: number }): void
	onResized?(args: { height: number; width: number }): void
	onFocus?(): void
	onIpcMessage?: (
		browserWindow: BrowserWindow,
		ipcChannel: string,
		...args: Array<any>
	) => void
}

export type BrowserWindowOptions = {
	webPreferences: Electron.WebPreferences
	loadFile: string
}

export class VirtualBrowserWindow {
	private browserWindow: BrowserWindow

	constructor(
		private props: BrowserWindowProps,
		options: BrowserWindowOptions
	) {
		const { x, y, height, width } = props
		this.browserWindow = new BrowserWindow({
			show: false,
			x,
			y,
			height,
			width,
			webPreferences: options.webPreferences,
		})
		this.browserWindow.loadFile(options.loadFile)

		this.browserWindow.on("close", this.handleClose)
		this.browserWindow.on("closed", this.handleClosed)
		this.browserWindow.on("move", this.handleMove)
		this.browserWindow.on("moved", this.handleMoved)
		this.browserWindow.on("resize", this.handleResize)
		this.browserWindow.on("resized", this.handleResized)
		this.browserWindow.on("focus", this.handleFocus)
		this.browserWindow.webContents.on("ipc-message", this.handleIpcMessage)

		if (props.focused) {
			this.browserWindow.show()
		} else {
			this.browserWindow.showInactive()
		}
	}

	private handleClose = () => this.props.onClose && this.props.onClose()
	private handleClosed = () => this.props.onClosed && this.props.onClosed()
	private handleMove = () => {
		if (!this.props.onMove) return
		const [x, y] = this.browserWindow.getPosition()
		if (this.props.x === x && this.props.y === y) return
		this.props.onMove({ x, y })
	}
	private handleMoved = () => {
		if (!this.props.onMoved) return
		const [x, y] = this.browserWindow.getPosition()
		if (this.props.x === x && this.props.y === y) return
		this.props.onMoved({ x, y })
	}
	private handleResize = () => {
		if (!this.props.onResize) return
		const [width, height] = this.browserWindow.getSize()
		if (this.props.width === width && this.props.height === height) return
		this.props.onResize({ width, height })
	}
	private handleResized = () => {
		if (!this.props.onResized) return
		const [width, height] = this.browserWindow.getSize()
		if (this.props.width === width && this.props.height === height) return
		this.props.onResized({ width, height })
	}
	private handleFocus = () => {
		if (!this.props.onFocus) return
		if (this.props.focused) return
		this.props.onFocus()
	}

	private handleIpcMessage = (
		event: IpcRendererEvent,
		ipcChannel: string,
		...args: Array<any>
	) => {
		if (this.props.onIpcMessage) {
			this.props.onIpcMessage(this.browserWindow, ipcChannel, ...args)
		}
	}

	focus() {
		this.browserWindow.focus()
	}

	update(props: BrowserWindowProps) {
		if (this.props.id !== props.id) {
			throw new Error("VirtualBrowserWindow id should never change.")
		}

		// Update position.
		if (props.x !== this.props.x || props.y !== this.props.y) {
			const [x, y] = this.browserWindow.getPosition()
			if (this.props.x !== x || this.props.y !== y) {
				this.browserWindow.setPosition(x, y, false)
			}
		}

		// Update size.
		if (
			props.width !== this.props.width ||
			props.height !== this.props.height
		) {
			const [width, height] = this.browserWindow.getSize()
			if (this.props.height !== height || this.props.width !== width) {
				this.browserWindow.setSize(width, height, false)
			}
		}

		// Set the focus.
		if (props.focused !== this.props.focused) {
			if (props.focused && !this.browserWindow.isFocused()) {
				this.browserWindow.focus()
			}
		}

		// Update the event listener references.
		this.props = props
	}

	destroy() {
		this.browserWindow.destroy()
	}
}

export class VirtualBrowserWindows {
	private virtualWindows: { [id: string]: VirtualBrowserWindow } = {}

	constructor(
		private windowProps: BrowserWindowProps[],
		private windowOptions: BrowserWindowOptions
	) {
		for (const props of windowProps) {
			this.virtualWindows[props.id] = new VirtualBrowserWindow(
				props,
				windowOptions
			)
		}
	}

	update(nextWindowProps: BrowserWindowProps[]) {
		const prevWindowProps = this.windowProps

		const createWindows = differenceBy(
			nextWindowProps,
			prevWindowProps,
			(win) => win.id
		)
		const destroyWindows = differenceBy(
			prevWindowProps,
			nextWindowProps,
			(win) => win.id
		)
		// Note: this returns values only from the first array.
		const updateWindows = intersectionBy(
			nextWindowProps,
			prevWindowProps,
			(win) => win.id
		)

		for (const oldProps of destroyWindows) {
			this.virtualWindows[oldProps.id].destroy()
			delete this.virtualWindows[oldProps.id]
		}
		for (const nextProps of updateWindows) {
			this.virtualWindows[nextProps.id].update(nextProps)
		}
		for (const props of createWindows) {
			this.virtualWindows[props.id] = new VirtualBrowserWindow(
				props,
				this.windowOptions
			)
		}
	}

	destroy() {
		for (const virtualWindow of Object.values(this.virtualWindows)) {
			virtualWindow.destroy()
		}
	}
}
