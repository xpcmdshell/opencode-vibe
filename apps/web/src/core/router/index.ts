/**
 * Effect-based router for OpenCode - Public API
 *
 * This module exports the complete public API for the Effect router.
 * All exports are organized by category for clarity.
 */

// Core router
export { createRouter, RouteNotFoundError } from "./router"

// Route builder
export { createOpencodeRoute } from "./builder"

// Routes
export { createRoutes } from "./routes"
export type { Routes } from "./routes"

// Adapters
export { createCaller } from "./adapters/direct"
export type { Caller, CallerContext } from "./adapters/direct"

export { createNextHandler, createAction } from "./adapters/next"
export type { NextHandlerOptions, ActionOptions } from "./adapters/next"

// Error types
export {
	ValidationError,
	TimeoutError,
	HandlerError,
	StreamError,
	HeartbeatTimeoutError,
	MiddlewareError,
} from "./errors"

// Schedule utilities
export { parseDuration, buildSchedule } from "./schedule"
