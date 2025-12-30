/**
 * Effect-based router for OpenCode - Public API
 *
 * This module exports the complete public API for the Effect router.
 * All exports are organized by category for clarity.
 */

// Core router
export { createRouter, RouteNotFoundError } from "./router.js"

// Route builder
export { createOpencodeRoute } from "./builder.js"

// Routes
export { createRoutes } from "./routes.js"
export type { Routes } from "./routes.js"

// Adapters
export { createCaller } from "./adapters/direct.js"
export type { Caller, CallerContext } from "./adapters/direct.js"

export { createNextHandler, createAction } from "./adapters/next.js"
export type { NextHandlerOptions, ActionOptions } from "./adapters/next.js"

// Error types
export {
	ValidationError,
	TimeoutError,
	HandlerError,
	StreamError,
	HeartbeatTimeoutError,
	MiddlewareError,
} from "./errors.js"

// Schedule utilities
export { parseDuration, buildSchedule } from "./schedule.js"
