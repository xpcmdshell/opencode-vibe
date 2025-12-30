/**
 * Subagents Atom (Phase 5 - Zustand Replacement)
 *
 * React hook for subagent session management.
 * Replaces stores/subagent-store.ts with plain React state.
 *
 * Provides:
 * - Subagent session registration and tracking
 * - Message and part management for child sessions
 * - UI expansion state for Task tool parts
 * - Parent part ID to session mapping
 *
 * @module atoms/subagents
 */

"use client"

import { useState, useCallback } from "react"
import type { Message, Part } from "@opencode-vibe/react"

/**
 * Subagent session state
 */
export interface SubagentSession {
	id: string
	parentSessionId: string
	parentPartId: string // The Task tool part that spawned this
	agentName: string
	status: "running" | "completed" | "error"
	messages: Message[]
	parts: Record<string, Part[]> // By message ID
}

/**
 * Hook return type with state and actions
 */
export interface UseSubagentsReturn {
	// State
	sessions: Record<string, SubagentSession>
	partToSession: Record<string, string>

	// Actions
	registerSubagent: (
		childSessionId: string,
		parentSessionId: string,
		parentPartId: string,
		agentName: string,
	) => void

	updateParentPartId: (childSessionId: string, parentPartId: string) => void

	addMessage: (sessionId: string, message: Message) => void
	updateMessage: (sessionId: string, message: Message) => void
	addPart: (sessionId: string, messageId: string, part: Part) => void
	updatePart: (sessionId: string, messageId: string, part: Part) => void
	setStatus: (sessionId: string, status: SubagentSession["status"]) => void

	toggleExpanded: (partId: string) => void
	isExpanded: (partId: string) => boolean

	getByParentPart: (partId: string) => SubagentSession | undefined
}

/**
 * React hook to manage subagent sessions
 *
 * Features:
 * - Tracks child agent sessions spawned via Task tool
 * - Manages messages and parts for each subagent
 * - Auto-expands running subagents in UI
 * - Provides parent part ID to session mapping
 *
 * @returns UseSubagentsReturn with state and actions
 *
 * @example
 * ```tsx
 * const subagents = useSubagents()
 *
 * // Register a new subagent
 * subagents.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
 *
 * // Add messages
 * subagents.addMessage("child-123", message)
 *
 * // Check expansion state
 * if (subagents.isExpanded("part-789")) {
 *   // Render expanded UI
 * }
 *
 * // Get session by parent part
 * const session = subagents.getByParentPart("part-789")
 * ```
 */
export function useSubagents(): UseSubagentsReturn {
	const [sessions, setSessions] = useState<Record<string, SubagentSession>>({})
	const [partToSession, setPartToSession] = useState<Record<string, string>>({})
	const [expanded, setExpanded] = useState<Set<string>>(new Set())

	const registerSubagent = useCallback(
		(childSessionId: string, parentSessionId: string, parentPartId: string, agentName: string) => {
			setSessions((prev) => ({
				...prev,
				[childSessionId]: {
					id: childSessionId,
					parentSessionId,
					parentPartId,
					agentName,
					status: "running",
					messages: [],
					parts: {},
				},
			}))

			if (parentPartId) {
				setPartToSession((prev) => ({
					...prev,
					[parentPartId]: childSessionId,
				}))
				// Auto-expand running subagents so users can see activity
				setExpanded((prev) => new Set(prev).add(parentPartId))
			}
		},
		[],
	)

	const updateParentPartId = useCallback((childSessionId: string, parentPartId: string) => {
		setSessions((prev) => {
			const session = prev[childSessionId]
			if (!session) return prev

			return {
				...prev,
				[childSessionId]: {
					...session,
					parentPartId,
				},
			}
		})

		setPartToSession((prev) => ({
			...prev,
			[parentPartId]: childSessionId,
		}))

		// Auto-expand when we learn the parentPartId (subagent is running)
		setSessions((prev) => {
			const session = prev[childSessionId]
			if (session?.status === "running") {
				setExpanded((prevExpanded) => new Set(prevExpanded).add(parentPartId))
			}
			return prev
		})
	}, [])

	const addMessage = useCallback((sessionId: string, message: Message) => {
		setSessions((prev) => {
			const session = prev[sessionId]
			if (!session) return prev

			return {
				...prev,
				[sessionId]: {
					...session,
					messages: [...session.messages, message],
					parts: {
						...session.parts,
						[message.id]: [],
					},
				},
			}
		})
	}, [])

	const updateMessage = useCallback((sessionId: string, message: Message) => {
		setSessions((prev) => {
			const session = prev[sessionId]
			if (!session) return prev

			const idx = session.messages.findIndex((m) => m.id === message.id)
			if (idx === -1) return prev

			const messages = [...session.messages]
			messages[idx] = message

			return {
				...prev,
				[sessionId]: {
					...session,
					messages,
				},
			}
		})
	}, [])

	const addPart = useCallback((sessionId: string, messageId: string, part: Part) => {
		setSessions((prev) => {
			const session = prev[sessionId]
			if (!session) return prev

			const currentParts = session.parts[messageId] || []

			return {
				...prev,
				[sessionId]: {
					...session,
					parts: {
						...session.parts,
						[messageId]: [...currentParts, part],
					},
				},
			}
		})
	}, [])

	const updatePart = useCallback((sessionId: string, messageId: string, part: Part) => {
		setSessions((prev) => {
			const session = prev[sessionId]
			if (!session || !session.parts[messageId]) return prev

			const parts = session.parts[messageId]
			const idx = parts.findIndex((p) => p.id === part.id)
			if (idx === -1) return prev

			const updatedParts = [...parts]
			updatedParts[idx] = part

			return {
				...prev,
				[sessionId]: {
					...session,
					parts: {
						...session.parts,
						[messageId]: updatedParts,
					},
				},
			}
		})
	}, [])

	const setStatus = useCallback((sessionId: string, status: SubagentSession["status"]) => {
		setSessions((prev) => {
			const session = prev[sessionId]
			if (!session) return prev

			return {
				...prev,
				[sessionId]: {
					...session,
					status,
				},
			}
		})
	}, [])

	const toggleExpanded = useCallback((partId: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(partId)) {
				next.delete(partId)
			} else {
				next.add(partId)
			}
			return next
		})
	}, [])

	const isExpanded = useCallback(
		(partId: string) => {
			return expanded.has(partId)
		},
		[expanded],
	)

	const getByParentPart = useCallback(
		(partId: string) => {
			const sessionId = partToSession[partId]
			return sessionId ? sessions[sessionId] : undefined
		},
		[partToSession, sessions],
	)

	return {
		sessions,
		partToSession,
		registerSubagent,
		updateParentPartId,
		addMessage,
		updateMessage,
		addPart,
		updatePart,
		setStatus,
		toggleExpanded,
		isExpanded,
		getByParentPart,
	}
}
