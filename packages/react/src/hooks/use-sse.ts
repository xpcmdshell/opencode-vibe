/**
 * SSE hook stub for packages/react
 * Actual implementation is app-specific
 */

export interface UseSSEReturn {
	subscribe: (eventType: string, callback: (event: any) => void) => () => void
	connected: boolean
}

export function useSSE(): UseSSEReturn {
	return {
		subscribe: (_eventType: string, _callback: (event: any) => void) => {
			// Stub - returns no-op unsubscribe
			return () => {}
		},
		connected: false,
	}
}
