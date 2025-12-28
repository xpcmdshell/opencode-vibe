import { useCallback, useState, useRef } from "react"
import { createClient } from "@/core/client"
import type { Prompt } from "@/types/prompt"
import { convertToApiParts } from "@/lib/prompt-api"

export interface ModelSelection {
	providerID: string
	modelID: string
}

export interface UseSendMessageOptions {
	sessionId: string
	directory?: string
}

interface QueuedMessage {
	parts: Prompt
	model?: ModelSelection
	resolve: () => void
	reject: (error: Error) => void
}

export interface UseSendMessageReturn {
	sendMessage: (parts: Prompt, model?: ModelSelection) => Promise<void>
	isLoading: boolean
	error?: Error
	/** Number of messages waiting in queue */
	queueLength: number
}

/**
 * Hook for sending messages to an OpenCode session.
 *
 * Accepts rich prompt parts (text, file attachments) and converts them
 * to API format before sending.
 *
 * @example
 * ```tsx
 * const { sendMessage, isLoading, error } = useSendMessage({
 *   sessionId: "ses_123",
 *   directory: "/path/to/project"
 * })
 *
 * const parts: Prompt = [
 *   { type: "text", content: "Fix bug in ", start: 0, end: 11 },
 *   { type: "file", path: "src/auth.ts", content: "@src/auth.ts", start: 11, end: 23 }
 * ]
 * await sendMessage(parts)
 * ```
 */
export function useSendMessage({
	sessionId,
	directory,
}: UseSendMessageOptions): UseSendMessageReturn {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | undefined>(undefined)
	const [queueLength, setQueueLength] = useState(0)

	// Queue for pending messages
	const queueRef = useRef<QueuedMessage[]>([])
	const isProcessingRef = useRef(false)

	// Process a single message
	// NOTE: We create the client fresh each time to pick up the latest
	// server discovery from multiServerSSE. The session->port mapping
	// updates dynamically as we receive SSE events.
	const processMessage = useCallback(
		async (parts: Prompt, model?: ModelSelection) => {
			// Create client fresh to get latest server routing
			// Pass sessionId for session-specific routing (routes to the server that owns this session)
			const client = createClient(directory, sessionId)

			// Convert client parts to API format
			const apiParts = convertToApiParts(parts, directory || "")

			const response = await client.session.prompt({
				path: { id: sessionId },
				body: {
					parts: apiParts,
					model: model
						? {
								providerID: model.providerID,
								modelID: model.modelID,
							}
						: undefined,
				},
			})

			// Check if SDK returned an error in the response
			if (response.error) {
				const errorMessage =
					typeof response.error === "object" && "message" in response.error
						? String(response.error.message)
						: String(response.error)
				throw new Error(errorMessage)
			}
		},
		[sessionId, directory],
	)

	// Process the queue - runs until queue is empty
	const processQueue = useCallback(async () => {
		// If already processing, the loop will pick up new items
		if (isProcessingRef.current) return
		isProcessingRef.current = true
		setIsLoading(true)

		// Keep processing while there are items
		// This handles items added while we're processing
		while (queueRef.current.length > 0) {
			const message = queueRef.current[0]! // Peek first

			try {
				setError(undefined)
				await processMessage(message.parts, message.model)
				// Only remove after successful processing
				queueRef.current.shift()
				setQueueLength(queueRef.current.length)
				message.resolve()
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				setError(error)
				// Remove failed message too
				queueRef.current.shift()
				setQueueLength(queueRef.current.length)
				message.reject(error)
				// Continue processing queue even on error
			}
		}

		isProcessingRef.current = false
		setIsLoading(false)
	}, [processMessage])

	const sendMessage = useCallback(
		async (parts: Prompt, model?: ModelSelection) => {
			// Don't send empty messages
			if (parts.length === 0) {
				return
			}

			return new Promise<void>((resolve, reject) => {
				// Add to queue
				queueRef.current.push({ parts, model, resolve, reject })
				setQueueLength(queueRef.current.length)

				// Start processing if not already
				processQueue()
			})
		},
		[processQueue],
	)

	return {
		sendMessage,
		isLoading,
		error,
		queueLength,
	}
}
