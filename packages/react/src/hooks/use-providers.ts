import { useCallback, useEffect, useMemo, useState } from "react"
import { useOpenCode } from "../providers"

export interface Provider {
	id: string
	name: string
	models: Model[]
}

export interface Model {
	id: string
	name: string
}

export interface UseProvidersReturn {
	providers: Provider[]
	isLoading: boolean
	error?: Error
}

/**
 * Hook for fetching available AI providers and their models.
 *
 * Uses the router caller to invoke provider.list route.
 * Directory scoping is handled by the OpenCodeProvider context.
 *
 * @example
 * ```tsx
 * const { providers, isLoading, error } = useProviders()
 *
 * if (isLoading) return <div>Loading...</div>
 * if (error) return <div>Error: {error.message}</div>
 *
 * return (
 *   <select>
 *     {providers.map(provider =>
 *       provider.models.map(model => (
 *         <option key={`${provider.id}-${model.id}`}>
 *           {provider.name} - {model.name}
 *         </option>
 *       ))
 *     )}
 *   </select>
 * )
 * ```
 */
export function useProviders(): UseProvidersReturn {
	const [providers, setProviders] = useState<Provider[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | undefined>(undefined)

	// Get caller from context
	const { caller } = useOpenCode()

	// Fetch providers on mount
	useEffect(() => {
		let isCancelled = false

		async function fetchProviders() {
			setIsLoading(true)
			setError(undefined)

			try {
				// Caller returns unwrapped data (no .data property)
				const response = (await caller("provider.list", {})) as {
					all: Provider[]
					connected: string[]
					default: Record<string, string>
				}
				if (!isCancelled) {
					// Response is already unwrapped: { all: Provider[], default: Provider, connected: string[] }
					// Each provider has models as a dictionary { [key: string]: Model }
					// We need to transform to our interface where models is an array
					const rawProviders = response.all ?? []
					const transformedProviders: Provider[] = rawProviders.map((p: any) => ({
						id: p.id,
						name: p.name,
						// Transform models dictionary to array
						models: p.models
							? Object.entries(p.models).map(([id, model]: [string, any]) => ({
									id,
									name: model.name || id,
								}))
							: [],
					}))
					setProviders(transformedProviders)
				}
			} catch (err) {
				if (!isCancelled) {
					const error = err instanceof Error ? err : new Error(String(err))
					setError(error)
				}
			} finally {
				if (!isCancelled) {
					setIsLoading(false)
				}
			}
		}

		fetchProviders()

		return () => {
			isCancelled = true
		}
	}, [caller])

	return {
		providers,
		isLoading,
		error,
	}
}
