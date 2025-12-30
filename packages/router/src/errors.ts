import { Data } from "effect"
import type { ParseIssue } from "effect/ParseResult"

export class RouteError extends Data.TaggedError("RouteError")<{
	route?: string
	cause: unknown
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	route?: string
	issues: ParseIssue[]
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError")<{
	route?: string
	duration: string
}> {}

export class HandlerError extends Data.TaggedError("HandlerError")<{
	route?: string
	cause: unknown
}> {}

export class StreamError extends Data.TaggedError("StreamError")<{
	route?: string
	cause: unknown
}> {}

export class HeartbeatTimeoutError extends Data.TaggedError("HeartbeatTimeoutError")<{
	route?: string
	duration: string
}> {}

export class MiddlewareError extends Data.TaggedError("MiddlewareError")<{
	route?: string
	cause: unknown
}> {}
