/**
 * Provider Atoms (Phase 1 - Interim)
 *
 * React hooks for AI provider management using SDK directly.
 * Phase 1: Simple SDK wrapper hooks (no Effect service yet)
 * Phase 2: May migrate to Effect service pattern if needed
 *
 * Provides:
 * - Provider list fetching from SDK
 * - Model enumeration per provider
 * - React hooks for easy consumption
 *
 * @module atoms/providers
 */

"use client"

import { useState, useEffect } from "react"
import { globalClient } from "../core/client"

/**
 * AI model information
 */
export interface Model {
	id: string
	name: string
}

/**
 * AI provider with available models
 */
export interface Provider {
	id: string
	name: string
	models: Model[]
}

/**
 * Transform SDK provider response (models as dictionary) to our interface (models as array)
 *
 * SDK format: { models: { [key: string]: { name: string } } }
 * Our format: { models: Model[] }
 *
 * @param rawProvider - Provider from SDK with models as dictionary
 * @returns Provider with models as array
 */
function transformProvider(rawProvider: any): Provider {
	return {
		id: rawProvider.id,
		name: rawProvider.name,
		models: rawProvider.models
			? Object.entries(rawProvider.models).map(([id, model]: [string, any]) => ({
					id,
					name: model.name || id,
				}))
			: [],
	}
}

/**
 * React hook to fetch and track AI providers
 *
 * Fetches provider list from SDK on mount.
 * Includes all available providers with their models.
 *
 * @returns Object with providers array, loading boolean, and error
 *
 * @example
 * ```tsx
 * const { providers, loading, error } = useProviders()
 * if (loading) return <div>Loading providers...</div>
 * if (error) return <div>Error: {error.message}</div>
 * return (
 *   <select>
 *     {providers.flatMap(p =>
 *       p.models.map(m => (
 *         <option key={`${p.id}-${m.id}`} value={m.id}>
 *           {p.name} - {m.name}
 *         </option>
 *       ))
 *     )}
 *   </select>
 * )
 * ```
 */
export function useProviders() {
	const [providers, setProviders] = useState<Provider[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let cancelled = false

		const fetchProviders = async () => {
			setLoading(true)
			setError(null)

			try {
				// Fetch from SDK
				const response = await globalClient.provider.list()

				if (cancelled) return

				// Transform SDK response
				// SDK returns: { all: Provider[], default: Provider, connected: string[] }
				const rawProviders = response.data?.all ?? []
				const transformed = rawProviders.map(transformProvider)

				setProviders(transformed)
				setLoading(false)
			} catch (err) {
				if (cancelled) return

				setError(err instanceof Error ? err : new Error(String(err)))
				setProviders([])
				setLoading(false)
			}
		}

		fetchProviders()

		return () => {
			cancelled = true
		}
	}, [])

	return { providers, loading, error }
}
