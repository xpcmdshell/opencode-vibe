/**
 * Subagent store for OpenCode React package
 * Tracks child sessions spawned via Task tool
 */

import { create } from "zustand"

export interface SubagentSession {
	id: string
	parentSessionId: string
	parentPartId: string
	agentName: string
	status: "running" | "completed" | "error"
	messages: any[]
	parts: Record<string, any[]> // messageId -> parts
}

export interface SubagentStore {
	sessions: Record<string, SubagentSession>
	partToSession: Record<string, string> // parentPartId -> sessionId mapping
	expanded: Set<string>

	// Actions
	registerSubagent: (
		sessionId: string,
		parentSessionId: string,
		parentPartId: string,
		agentName: string,
	) => void
	updateParentPartId: (sessionId: string, parentPartId: string) => void
	setStatus: (sessionId: string, status: SubagentSession["status"]) => void
	addMessage: (sessionId: string, message: any) => void
	updateMessage: (sessionId: string, message: any) => void
	addPart: (sessionId: string, messageId: string, part: any) => void
	updatePart: (sessionId: string, messageId: string, part: any) => void

	// Selectors
	getByParentPart: (parentPartId: string) => SubagentSession | undefined
	isExpanded: (partId: string) => boolean
	toggleExpanded: (partId: string) => void
}

export const useSubagentStore = create<SubagentStore>((set, get) => ({
	sessions: {},
	partToSession: {},
	expanded: new Set(),

	registerSubagent: (sessionId, parentSessionId, parentPartId, agentName) => {
		set((state) => {
			const newSessions = {
				...state.sessions,
				[sessionId]: {
					id: sessionId,
					parentSessionId,
					parentPartId,
					agentName,
					status: "running" as const,
					messages: [],
					parts: {},
				},
			}

			// Update partToSession mapping if parentPartId is provided
			const newPartToSession = { ...state.partToSession }
			if (parentPartId) {
				newPartToSession[parentPartId] = sessionId
			}

			// Auto-expand running subagents
			const newExpanded = new Set(state.expanded)
			if (parentPartId) {
				newExpanded.add(parentPartId)
			}

			return {
				sessions: newSessions,
				partToSession: newPartToSession,
				expanded: newExpanded,
			}
		})
	},

	updateParentPartId: (sessionId, parentPartId) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state

			return {
				sessions: {
					...state.sessions,
					[sessionId]: { ...session, parentPartId },
				},
				partToSession: {
					...state.partToSession,
					[parentPartId]: sessionId,
				},
			}
		})
	},

	setStatus: (sessionId, status) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state
			return {
				sessions: {
					...state.sessions,
					[sessionId]: { ...session, status },
				},
			}
		})
	},

	addMessage: (sessionId, message) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state
			return {
				sessions: {
					...state.sessions,
					[sessionId]: {
						...session,
						messages: [...session.messages, message],
					},
				},
			}
		})
	},

	updateMessage: (sessionId, message) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state
			const idx = session.messages.findIndex((m) => m.id === message.id)
			if (idx === -1) return state
			const newMessages = [...session.messages]
			newMessages[idx] = message
			return {
				sessions: {
					...state.sessions,
					[sessionId]: { ...session, messages: newMessages },
				},
			}
		})
	},

	addPart: (sessionId, messageId, part) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state
			const messageParts = session.parts[messageId] || []
			return {
				sessions: {
					...state.sessions,
					[sessionId]: {
						...session,
						parts: {
							...session.parts,
							[messageId]: [...messageParts, part],
						},
					},
				},
			}
		})
	},

	updatePart: (sessionId, messageId, part) => {
		set((state) => {
			const session = state.sessions[sessionId]
			if (!session) return state
			const messageParts = session.parts[messageId] || []
			const idx = messageParts.findIndex((p) => p.id === part.id)
			if (idx === -1) return state
			const newParts = [...messageParts]
			newParts[idx] = part
			return {
				sessions: {
					...state.sessions,
					[sessionId]: {
						...session,
						parts: {
							...session.parts,
							[messageId]: newParts,
						},
					},
				},
			}
		})
	},

	getByParentPart: (parentPartId) => {
		const state = get()
		const sessionId = state.partToSession[parentPartId]
		return sessionId ? state.sessions[sessionId] : undefined
	},

	isExpanded: (partId) => {
		return get().expanded.has(partId)
	},

	toggleExpanded: (partId) => {
		set((state) => {
			const newExpanded = new Set(state.expanded)
			if (newExpanded.has(partId)) {
				newExpanded.delete(partId)
			} else {
				newExpanded.add(partId)
			}
			return { expanded: newExpanded }
		})
	},
}))
