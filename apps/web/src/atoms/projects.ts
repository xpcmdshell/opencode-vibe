/**
 * Project Management Hooks (Phase 1 - Interim)
 *
 * React hooks for project list and current project fetching.
 * Phase 1: Wrap SDK calls in hooks (simplified effect-atom pattern)
 * Phase 2: Full effect-atom migration when patterns are stable
 *
 * Provides:
 * - Project list fetching via SDK
 * - Current project fetching
 * - Error handling with empty fallback
 *
 * @module atoms/projects
 */

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/core/client"

/**
 * Project information from the SDK
 * This matches the shape returned by client.project.list() and client.project.current()
 */
export interface Project {
	/** Project worktree path */
	worktree: string
	/** Project name (derived from path) */
	name?: string
}

/**
 * Project list state
 */
export interface ProjectListState {
	/** List of projects */
	projects: Project[]
	/** Whether initial fetch is in progress */
	loading: boolean
	/** Last error if fetch failed */
	error: Error | null
}

/**
 * Current project state
 */
export interface CurrentProjectState {
	/** Current project or null if none */
	project: Project | null
	/** Whether initial fetch is in progress */
	loading: boolean
	/** Last error if fetch failed */
	error: Error | null
}

/**
 * React hook to fetch and track project list
 *
 * Features:
 * - Fetches projects on mount
 * - Falls back to empty array on error
 *
 * @returns ProjectListState with projects, loading, error
 *
 * @example
 * ```tsx
 * const { projects, loading, error } = useProjects()
 *
 * if (loading) return <div>Loading projects...</div>
 * if (error) console.warn("Failed to load projects:", error)
 *
 * return (
 *   <ul>
 *     {projects.map(p => <li key={p.worktree}>{p.name}</li>)}
 *   </ul>
 * )
 * ```
 */
export function useProjects(): ProjectListState {
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let cancelled = false

		const fetchProjects = async () => {
			setLoading(true)
			setError(null)

			try {
				const client = createClient()
				const response = await client.project.list()

				if (cancelled) return

				// Extract projects from response
				// SDK returns { data: [...] } structure
				setProjects(response.data || [])
				setLoading(false)
			} catch (err) {
				if (cancelled) return

				const errorObj = err instanceof Error ? err : new Error(String(err))
				setError(errorObj)
				setProjects([]) // Fallback to empty array on error
				setLoading(false)
			}
		}

		fetchProjects()

		return () => {
			cancelled = true
		}
	}, [])

	return { projects, loading, error }
}

/**
 * React hook to get the current project
 *
 * Features:
 * - Fetches current project on mount
 * - Returns null if no project is active
 * - Falls back to null on error
 *
 * @returns CurrentProjectState with project, loading, error
 *
 * @example
 * ```tsx
 * const { project, loading, error } = useCurrentProject()
 *
 * if (loading) return <div>Loading current project...</div>
 * if (error) console.warn("Failed to load current project:", error)
 * if (!project) return <div>No project selected</div>
 *
 * return <div>Current project: {project.name}</div>
 * ```
 */
export function useCurrentProject(): CurrentProjectState {
	const [project, setProject] = useState<Project | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let cancelled = false

		const fetchCurrentProject = async () => {
			setLoading(true)
			setError(null)

			try {
				const client = createClient()
				const response = await client.project.current()

				if (cancelled) return

				// Extract project from response
				// SDK returns { data: {...} } structure
				setProject(response.data || null)
				setLoading(false)
			} catch (err) {
				if (cancelled) return

				const errorObj = err instanceof Error ? err : new Error(String(err))
				setError(errorObj)
				setProject(null) // Fallback to null on error
				setLoading(false)
			}
		}

		fetchCurrentProject()

		return () => {
			cancelled = true
		}
	}, [])

	return { project, loading, error }
}
