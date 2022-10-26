import { RendererApp } from "../RendererApp"

export class DisplayWindowRectPlugin {
	details: HTMLDivElement
	button: HTMLButtonElement

	constructor(private app: RendererApp) {
		this.details = document.createElement("div")
		this.details.innerText = JSON.stringify(app.state, null, 2)
		document.body.appendChild(this.details)

		this.button = document.createElement("button")
		this.button.innerText = "Move"
		document.body.appendChild(this.button)
		this.button.addEventListener("click", () => {
			const { x, y } = app.state.rect
			app.dispatch.moveWindow({ x: x + 20, y })
		})
	}

	update() {
		this.details.innerText = JSON.stringify(this.app.state, null, 2)
	}

	destroy() {
		document.body.removeChild(this.details)
		document.body.removeChild(this.button)
	}
}
