/**
 * WorldState - Aggregated view of OpenCode servers
 *
 * Builds a coherent world view from SSE events across multiple servers.
 * Tracks sessions, their status, message activity, and streaming state.
 */

/**
 * Session status derived from events
 */
export type SessionStatus = "active" | "idle" | "completed" | "unknown"

/**
 * A session with enriched state
 */
export interface EnrichedSession {
	id: string
	projectKey: string
	status: SessionStatus
	messageCount: number
	lastActivityAt: number
	isStreaming: boolean
}

/**
 * Project aggregation - sessions grouped by directory
 */
export interface ProjectState {
	directory: string
	sessions: EnrichedSession[]
	activeCount: number
	totalMessages: number
	lastActivityAt: number
}

/**
 * Complete world state snapshot
 */
export interface WorldState {
	projects: ProjectState[]
	totalSessions: number
	activeSessions: number
	streamingSessions: number
	lastEventOffset: string
	lastUpdated: number
}

/**
 * Raw SSE event from OpenCode server
 */
export interface RawSSEEvent {
	type: string
	offset: string
	timestamp: number
	upToDate: boolean
	payload: Record<string, unknown>
}

/**
 * Internal session tracking
 */
interface SessionTracker {
	id: string
	projectKey: string
	status: SessionStatus
	messageCount: number
	lastActivityAt: number
	isStreaming: boolean
}

/**
 * WorldStateAggregator - Builds WorldState from SSE events
 *
 * Maintains internal state and produces snapshots on demand.
 * Handles all event types from OpenCode servers.
 */
export class WorldStateAggregator {
	private sessions = new Map<string, SessionTracker>()
	private lastOffset = "0"
	private lastUpdated = 0

	/**
	 * Process an SSE event and update internal state
	 */
	processEvent(event: RawSSEEvent): void {
		this.lastOffset = event.offset
		this.lastUpdated = event.timestamp

		switch (event.type) {
			case "session.created":
				this.handleSessionCreated(event)
				break
			case "session.updated":
			case "session.status":
				this.handleSessionUpdated(event)
				break
			case "session.completed":
				this.handleSessionCompleted(event)
				break
			case "message.updated":
			case "message.part.updated":
				this.handleMessageActivity(event)
				break
			case "session.diff":
				// Diff events indicate active streaming
				this.handleSessionDiff(event)
				break
			default:
				// Unknown event type - ignore but don't break
				break
		}
	}

	private handleSessionCreated(event: RawSSEEvent): void {
		const { id, projectKey } = event.payload as { id: string; projectKey: string }
		if (!this.sessions.has(id)) {
			this.sessions.set(id, {
				id,
				projectKey,
				status: "idle",
				messageCount: 0,
				lastActivityAt: event.timestamp,
				isStreaming: false,
			})
		}
	}

	private handleSessionUpdated(event: RawSSEEvent): void {
		const { id, status } = event.payload as { id: string; status?: string }
		const session = this.sessions.get(id)
		if (session) {
			if (status === "running" || status === "active") {
				session.status = "active"
			} else if (status === "completed" || status === "done") {
				session.status = "completed"
				session.isStreaming = false
			}
			session.lastActivityAt = event.timestamp
		}
	}

	private handleSessionCompleted(event: RawSSEEvent): void {
		const { id } = event.payload as { id: string }
		const session = this.sessions.get(id)
		if (session) {
			session.status = "completed"
			session.isStreaming = false
			session.lastActivityAt = event.timestamp
		}
	}

	private handleMessageActivity(event: RawSSEEvent): void {
		// Extract session ID from payload
		const payload = event.payload as { part?: { sessionID?: string }; sessionId?: string }
		const sessionId = payload.part?.sessionID || payload.sessionId
		if (!sessionId) return

		const session = this.sessions.get(sessionId)
		if (session) {
			session.messageCount++
			session.lastActivityAt = event.timestamp
			session.isStreaming = true
			session.status = "active"

			// Reset streaming flag after 5 seconds of no activity
			// (This is a simple heuristic - real implementation would use timers)
		}
	}

	private handleSessionDiff(event: RawSSEEvent): void {
		const { sessionId } = event.payload as { sessionId?: string }
		if (!sessionId) return

		const session = this.sessions.get(sessionId)
		if (session) {
			session.isStreaming = true
			session.status = "active"
			session.lastActivityAt = event.timestamp
		}
	}

	/**
	 * Get current world state snapshot
	 */
	getSnapshot(): WorldState {
		// Group sessions by project
		const projectMap = new Map<string, SessionTracker[]>()
		for (const session of this.sessions.values()) {
			const existing = projectMap.get(session.projectKey) || []
			existing.push(session)
			projectMap.set(session.projectKey, existing)
		}

		// Build project states
		const projects: ProjectState[] = []
		for (const [directory, sessions] of projectMap) {
			const enrichedSessions: EnrichedSession[] = sessions.map((s) => ({
				id: s.id,
				projectKey: s.projectKey,
				status: s.status,
				messageCount: s.messageCount,
				lastActivityAt: s.lastActivityAt,
				isStreaming: s.isStreaming,
			}))

			// Sort by last activity (most recent first)
			enrichedSessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt)

			projects.push({
				directory,
				sessions: enrichedSessions,
				activeCount: enrichedSessions.filter((s) => s.status === "active").length,
				totalMessages: enrichedSessions.reduce((sum, s) => sum + s.messageCount, 0),
				lastActivityAt: Math.max(...enrichedSessions.map((s) => s.lastActivityAt)),
			})
		}

		// Sort projects by last activity
		projects.sort((a, b) => b.lastActivityAt - a.lastActivityAt)

		// Calculate totals
		const allSessions = Array.from(this.sessions.values())
		const activeSessions = allSessions.filter((s) => s.status === "active").length
		const streamingSessions = allSessions.filter((s) => s.isStreaming).length

		return {
			projects,
			totalSessions: this.sessions.size,
			activeSessions,
			streamingSessions,
			lastEventOffset: this.lastOffset,
			lastUpdated: this.lastUpdated,
		}
	}

	/**
	 * Reset aggregator state
	 */
	reset(): void {
		this.sessions.clear()
		this.lastOffset = "0"
		this.lastUpdated = 0
	}
}

/**
 * Format WorldState for pretty output
 */
export function formatWorldState(state: WorldState): string {
	const lines: string[] = []

	lines.push("╔═══════════════════════════════════════════════════════════╗")
	lines.push("║                    🌍 WORLD STATE 🌍                      ║")
	lines.push("╠═══════════════════════════════════════════════════════════╣")
	lines.push(
		`║  Sessions: ${state.totalSessions.toString().padEnd(6)} Active: ${state.activeSessions.toString().padEnd(6)} Streaming: ${state.streamingSessions.toString().padEnd(4)} ║`,
	)
	lines.push("╠═══════════════════════════════════════════════════════════╣")

	if (state.projects.length === 0) {
		lines.push("║  No sessions found                                        ║")
	}

	for (const project of state.projects) {
		const shortDir = project.directory.replace(/^\/Users\/[^/]+/, "~")
		lines.push(`║  📁 ${shortDir.padEnd(52)} ║`)

		const activeIcon = project.activeCount > 0 ? "🟢" : "⚪"
		lines.push(
			`║     ${activeIcon} ${project.sessions.length} sessions, ${project.activeCount} active, ${project.totalMessages} msgs`.padEnd(
				58,
			) + " ║",
		)

		// Show top 3 most recent sessions
		const recentSessions = project.sessions.slice(0, 3)
		for (const session of recentSessions) {
			const statusIcon = session.isStreaming ? "⚡" : session.status === "active" ? "🔵" : "⚫"
			const shortId = session.id.slice(-8)
			const ago = formatTimeAgo(session.lastActivityAt)
			lines.push(
				`║       ${statusIcon} ${shortId} (${session.messageCount} msgs, ${ago})`.padEnd(58) + " ║",
			)
		}

		if (project.sessions.length > 3) {
			lines.push(`║       ... and ${project.sessions.length - 3} more`.padEnd(58) + " ║")
		}
	}

	lines.push("╠═══════════════════════════════════════════════════════════╣")
	const offset = state.lastEventOffset || "0"
	lines.push(`║  Offset: ${offset.padEnd(48)} ║`)
	lines.push("╚═══════════════════════════════════════════════════════════╝")

	return lines.join("\n")
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp

	if (diff < 1000) return "now"
	if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
	return `${Math.floor(diff / 86400000)}d ago`
}
