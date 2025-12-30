/**
 * useProviders - Bridge Promise API to React state
 *
 * Wraps providers.list from @opencode-vibe/core/api and manages React state.
 * Provides loading, error, and data states for provider list.
 *
 * @example
 * ```tsx
 * function ProviderList() {
 *   const { providers, loading, error, refetch } = useProviders()
 *
 *   if (loading) return <div>Loading providers...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <select>
 *       {providers.map(provider =>
 *         provider.models.map(model => (
 *           <option key={`${provider.id}-${model.id}`}>
 *             {provider.name} - {model.name}
 *           </option>
 *         ))
 *       )}
 *     </select>
 *   )
 * }
 * ```
 */

"use client"

import { providers } from "@opencode-vibe/core/api"
import type { Provider, Model } from "@opencode-vibe/core/atoms"
import { useFetch } from "./use-fetch"

export interface UseProvidersReturn {
	/** Array of providers with their models */
	providers: Provider[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch providers */
	refetch: () => void
}

/**
 * Hook to fetch provider list using Promise API from core
 *
 * @returns Object with providers, loading, error, and refetch
 */
export function useProviders(): UseProvidersReturn {
	const { data, loading, error, refetch } = useFetch(() => providers.list(), undefined, {
		initialData: [],
	})

	return {
		providers: data,
		loading,
		error,
		refetch,
	}
}

// Re-export types for convenience
export type { Provider, Model }
