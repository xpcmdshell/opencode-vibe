/**
 * Atoms index - exports all reactive state atoms
 *
 * Phase 1 (Interim): Export hooks that wrap Effect services directly
 * Phase 2 (Future): Export effect-atom atoms when @effect-atom is installed
 *
 * @module atoms
 */

export { useServers, useCurrentServer } from "./servers"

export {
	sseAtom,
	useSSEConnection,
	makeSSEAtom,
	type SSEConnectionState,
	type SSEConfig,
} from "./sse"

export {
	useSessionList,
	type SessionListState,
	type UseSessionListOptions,
} from "./sessions"

export {
	useMessages,
	makeMessagesAtom,
	type MessageListState,
	type UseMessagesOptions,
} from "./messages"

export {
	useMessageParts,
	makePartsAtom,
	type PartListState,
	type UseMessagePartsOptions,
} from "./parts"

export { useProviders, type Provider, type Model } from "./providers"

export {
	useProjects,
	useCurrentProject,
	type Project,
	type ProjectListState,
	type CurrentProjectState,
} from "./projects"
