export function sleep(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const secondMs = 1000
export const minuteMs = secondMs * 60
export const hourMs = minuteMs * 60
