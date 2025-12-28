/**
 * MSW HTTP handlers for testing
 *
 * Mock data and request handlers for all OpenCode API endpoints.
 * Import and customize these in tests for network-level mocking.
 */

import { http, HttpResponse } from "msw"

// Default mock data
export const mockSessions = [
	{
		id: "session-1",
		title: "Session 1",
		directory: "/test",
		time: { created: Date.now() - 2000, updated: Date.now() - 1000 },
	},
	{
		id: "session-2",
		title: "Session 2",
		directory: "/test",
		time: { created: Date.now() - 1000, updated: Date.now() },
	},
]

export const mockSessionStatus = {
	"session-1": "completed",
	"session-2": "running",
}

export const mockMessages = [
	{
		info: {
			id: "msg-1",
			sessionID: "session-1",
			role: "user",
			time: { created: Date.now() },
		},
		parts: [
			{
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello",
			},
		],
	},
]

export const mockFiles = [
	"src/app/page.tsx",
	"src/app/layout.tsx",
	"src/components/ui/button.tsx",
	"src/components/ui/input.tsx",
	"src/lib/utils.ts",
	"apps/web/src/app/session/[id]/page.tsx",
	"apps/web/src/react/use-session.ts",
	"apps/web/package.json",
]

/**
 * Default MSW handlers for OpenCode API
 */
export const handlers = [
	// Session endpoints
	http.get("*/session", () => {
		return HttpResponse.json({ data: mockSessions })
	}),

	http.get("*/session/status", () => {
		return HttpResponse.json({ data: mockSessionStatus })
	}),

	http.get("*/session/:id/messages", ({ params }) => {
		const sessionId = params.id as string
		const messagesForSession = mockMessages.map((msg) => ({
			...msg,
			info: { ...msg.info, sessionID: sessionId },
		}))
		return HttpResponse.json({ data: messagesForSession })
	}),

	http.get("*/session/:id/todo", () => {
		return HttpResponse.json({ data: [] })
	}),

	http.get("*/session/:id/diff", () => {
		return HttpResponse.json({ data: [] })
	}),

	http.post("*/session/:id/prompt", () => {
		return HttpResponse.json({ data: { success: true } })
	}),

	// File search
	http.get("*/find/files", () => {
		return HttpResponse.json({ data: mockFiles })
	}),
]
