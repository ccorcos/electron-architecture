/*

This is like a React component, returning a virtual view describing the BrowserWindows.

*/

import { ipcMessageHandler } from "./MainIPC"
import { MainApp } from "./MainApp"
import { BrowserWindowProps } from "./VirtualBrowserWindow"

export function MainView(app: MainApp): BrowserWindowProps[] {
	return app.state.windows.map((win, i) => {
		const { id, rect } = win

		const props: BrowserWindowProps = {
			id: id,
			focused: i === 0,
			...rect,
			onClose: () => app.dispatch({ type: "close-window", id }),
			onMoved: ({ x, y }) => app.dispatch({ type: "move-window", id, x, y }),
			onResized: ({ height, width }) =>
				app.dispatch({ type: "resize-window", id, height, width }),
			onFocus: () => app.dispatch({ type: "focus-window", id }),

			// Handle IPC messages.
			onIpcMessage: ipcMessageHandler({
				load: () => rect,
				setPosition: ({ x, y }) =>
					app.dispatch({ type: "move-window", id, x, y }),
				setSize: ({ height, width }) =>
					app.dispatch({ type: "resize-window", id, height, width }),
			}),
		}

		return props
	})
}

// callRenderer(this.browserWindow, "updateSize", rect)
// callRenderer(this.browserWindow, "updatePosition", rect)
