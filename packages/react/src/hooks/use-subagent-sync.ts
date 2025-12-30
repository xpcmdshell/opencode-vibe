/**
 * useSubagentSync - Subscribe to child session SSE events
 *
 * Handles real-time sync for subagent sessions spawned via Task tool.
 * Filters SSE events by parentSessionId to track only child sessions.
 *
 * Per SUBAGENT_DISPLAY.md lines 494-584.
 *
 * @param parentSessionId - The parent session ID to filter child sessions
 *
 * @example
 * ```tsx
 * function ParentSession({ sessionId }: { sessionId: string }) {
 *   useSubagentSync(sessionId)
 *   // Now subagent store is synced with SSE for all child sessions
 * }
 * ```
 */

import { useEffect, useRef } from "react"
import { useSSE } from "./use-sse"
import { useSubagentStore } from "../stores/subagent-store"

// Stub GlobalEvent type
interface GlobalEvent {
	payload: any
}

export function useSubagentSync(parentSessionId: string) {
	const { subscribe } = useSSE()
	const pendingChildSessions = useRef<Set<string>>(new Set())

	useEffect(() => {
		// Helper to check if a sessionID is a child of our parent
		// Checks live state each time, so newly registered children are tracked
		const isChildSession = (sessionID: string) => {
			const session = useSubagentStore.getState().sessions[sessionID]
			return session?.parentSessionId === parentSessionId
		}

		// Subscribe to events and filter for child sessions
		const unsubscribers = [
			// Detect new child sessions
			subscribe("session.created", (event: GlobalEvent) => {
				const session = (event.payload as any)?.properties?.info
				if (session?.parentID === parentSessionId) {
					const match = session.title?.match(/@(\w+)\s+subagent/)
					const agentName = match?.[1] || "unknown"
					useSubagentStore.getState().registerSubagent(session.id, parentSessionId, "", agentName)
					// Track pending child session waiting for parentPartId
					pendingChildSessions.current.add(session.id)
				}
			}),

			// Track session completion
			subscribe("session.status", (event: GlobalEvent) => {
				const { sessionID, status } = (event.payload as any)?.properties || {}
				if (isChildSession(sessionID) && status?.type === "idle") {
					useSubagentStore.getState().setStatus(sessionID, "completed")
				}
			}),

			// Track child messages
			subscribe("message.created", (event: GlobalEvent) => {
				const message = (event.payload as any)?.properties?.message
				if (message && isChildSession(message.sessionID)) {
					useSubagentStore.getState().addMessage(message.sessionID, message)
				}
			}),

			subscribe("message.updated", (event: GlobalEvent) => {
				const message = (event.payload as any)?.properties?.message
				if (message && isChildSession(message.sessionID)) {
					useSubagentStore.getState().updateMessage(message.sessionID, message)
				}
			}),

			// Track child parts (CRITICAL for streaming)
			subscribe("message.part.created", (event: GlobalEvent) => {
				const part = (event.payload as any)?.properties?.part
				if (part && isChildSession(part.sessionID)) {
					useSubagentStore.getState().addPart(part.sessionID, part.messageID, part)
				}
			}),

			subscribe("message.part.updated", (event: GlobalEvent) => {
				const part = (event.payload as any)?.properties?.part

				// Handle child session parts (existing logic)
				if (part && isChildSession(part.sessionID)) {
					useSubagentStore.getState().updatePart(part.sessionID, part.messageID, part)
				}

				// Handle PARENT session parts for Task tool mapping
				// NOTE: Backend sends sessionID (uppercase D), not sessionId
				if (
					part &&
					part.sessionID === parentSessionId &&
					part.type === "tool" &&
					part.tool === "task" &&
					part.state?.metadata?.sessionID
				) {
					const childSessionId = part.state.metadata.sessionID
					if (pendingChildSessions.current.has(childSessionId)) {
						useSubagentStore.getState().updateParentPartId(childSessionId, part.id)
						pendingChildSessions.current.delete(childSessionId)
					}
				}
			}),
		]

		return () => {
			for (const unsub of unsubscribers) {
				unsub()
			}
		}
	}, [parentSessionId, subscribe])
}
