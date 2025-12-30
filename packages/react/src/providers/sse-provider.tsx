/**
 * SSEProvider stub for packages/react
 * Minimal implementation - full version is app-specific
 */

"use client"

import { createContext, useContext, type ReactNode } from "react"

export interface SSEContextValue {
	subscribe: (eventType: string, callback: (event: any) => void) => () => void
}

const SSEContext = createContext<SSEContextValue | null>(null)

export interface SSEProviderProps {
	url: string
	children: ReactNode
}

export function SSEProvider({ children }: SSEProviderProps) {
	const value: SSEContextValue = {
		subscribe: () => () => {},
	}

	return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>
}

export function useSSE() {
	const context = useContext(SSEContext)
	if (!context) {
		throw new Error("useSSE must be used within SSEProvider")
	}
	return context
}
