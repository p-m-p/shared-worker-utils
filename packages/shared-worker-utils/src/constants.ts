/**
 * Internal message type constants used by PortManager and SharedWorkerClient
 */
export const MESSAGE_TYPES = {
  PING: '@shared-worker-utils/ping',
  PONG: '@shared-worker-utils/pong',
  DISCONNECT: '@shared-worker-utils/disconnect',
  VISIBILITY_CHANGE: '@shared-worker-utils/visibility-change',
  CLIENT_COUNT: '@shared-worker-utils/client-count',
} as const

/**
 * Type for message type values
 */
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]
