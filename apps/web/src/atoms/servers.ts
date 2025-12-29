/**
 * Server Discovery Hooks (Phase 1 - Interim)
 *
 * React hooks for OpenCode server discovery using Effect service directly.
 * Phase 1: Wrap Effect service in hooks (no effect-atom yet)
 * Phase 2: Migrate to effect-atom when @effect-atom is installed
 *
 * Provides:
 * - Effect-native server discovery integration
 * - Automatic fallback to localhost:4056
 * - React hooks for easy consumption
 *
 * @module atoms/servers
 */

"use client"

import { useState, useEffect } from "react"
import { Effect } from "effect"
import { ServerDiscovery, type ServerInfo, Default } from "../core/discovery"

/**
 * Default fallback server (localhost:4056)
 * CRITICAL: This must ALWAYS be available as fallback
 */
const DEFAULT_SERVER: ServerInfo = {
	port: 4056,
	directory: "",
	url: "http://localhost:4056",
}

/**
 * Select best server from list
 * Preference: first server with directory, otherwise first server
 *
 * @param servers - List of available servers
 * @returns The selected server
 */
export function selectBestServer(servers: ServerInfo[]): ServerInfo {
	// Prefer first server with a directory
	const serverWithDir = servers.find((s) => s.directory !== "")
	return serverWithDir || servers[0] || DEFAULT_SERVER
}

/**
 * React hook to discover and track OpenCode servers
 *
 * Runs discovery on mount and provides server list with loading/error states.
 * Always includes localhost:4056 as fallback.
 *
 * @returns Object with servers array, loading boolean, and error
 *
 * @example
 * ```tsx
 * const { servers, loading, error } = useServers()
 * if (loading) return <div>Discovering servers...</div>
 * if (error) return <div>Error: {error.message}</div>
 * return <div>Found {servers.length} servers</div>
 * ```
 */
export function useServers() {
	const [servers, setServers] = useState<ServerInfo[]>([DEFAULT_SERVER])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let cancelled = false

		const runDiscovery = async () => {
			setLoading(true)
			setError(null)

			try {
				// Run the Effect discovery service
				const discoveredServers = await Effect.runPromise(
					Effect.gen(function* () {
						const discovery = yield* ServerDiscovery
						return yield* discovery.discover()
					}).pipe(Effect.provide(Default)),
				)

				if (cancelled) return

				// CRITICAL: Always include localhost:4056 default
				if (discoveredServers.length === 0) {
					setServers([DEFAULT_SERVER])
				} else {
					// Check if default server already in list
					const hasDefault = discoveredServers.some(
						(s) => s.port === DEFAULT_SERVER.port && s.directory === DEFAULT_SERVER.directory,
					)

					// If default not found, prepend it
					setServers(hasDefault ? discoveredServers : [DEFAULT_SERVER, ...discoveredServers])
				}

				setLoading(false)
			} catch (err) {
				if (cancelled) return

				setError(err instanceof Error ? err : new Error(String(err)))
				// On error, fall back to default server
				setServers([DEFAULT_SERVER])
				setLoading(false)
			}
		}

		runDiscovery()

		return () => {
			cancelled = true
		}
	}, [])

	return { servers, loading, error }
}

/**
 * React hook to get the current "best" server
 *
 * Uses heuristic to select best server:
 * 1. First server with non-empty directory (active project)
 * 2. Otherwise, first server in list
 * 3. Falls back to localhost:4056 if discovery fails
 *
 * @returns ServerInfo for the current best server
 *
 * @example
 * ```tsx
 * const currentServer = useCurrentServer()
 * const client = createClient(currentServer.directory)
 * ```
 */
export function useCurrentServer(): ServerInfo {
	const { servers } = useServers()
	return selectBestServer(servers)
}
