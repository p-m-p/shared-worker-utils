/**
 * Internal message type constants
 */
export const MESSAGE_TYPES = {
  VISIBILITY_CHANGE: '@shared-worker-utils/visibility-change',
  DISCONNECT: '@shared-worker-utils/disconnect',
  PING: '@shared-worker-utils/ping',
  PONG: '@shared-worker-utils/pong',
  CLIENT_COUNT: '@shared-worker-utils/client-count',
} as const

/**
 * Type guard to check if a message is an internal message
 */
export function isInternalMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const message = data as { type?: string }
  if (typeof message.type !== 'string') {
    return false
  }

  return message.type.startsWith('@shared-worker-utils/')
}

/**
 * Validates message data structure
 */
export function normalizeMessage(data: unknown): {
  type?: string
  visible?: boolean
  total?: number
  active?: number
} {
  if (typeof data !== 'object' || data === null) {
    return {}
  }

  return data as {
    type?: string
    visible?: boolean
    total?: number
    active?: number
  }
}
