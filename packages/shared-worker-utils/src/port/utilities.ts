/**
 * Utility functions for port and connection management
 */

/**
 * Internal message type prefix
 */
export const INTERNAL_MESSAGE_PREFIX = '@shared-worker-utils/'

/**
 * Internal message types
 */
export const MESSAGE_TYPES = {
  PING: `${INTERNAL_MESSAGE_PREFIX}ping`,
  PONG: `${INTERNAL_MESSAGE_PREFIX}pong`,
  VISIBILITY_CHANGE: `${INTERNAL_MESSAGE_PREFIX}visibility-change`,
  DISCONNECT: `${INTERNAL_MESSAGE_PREFIX}disconnect`,
  CLIENT_COUNT: `${INTERNAL_MESSAGE_PREFIX}client-count`,
} as const

/**
 * Check if a message is an internal message
 */
export function isInternalMessage(data: unknown): boolean {
  const message = data as { type?: string }
  return (
    typeof message.type === 'string' &&
    message.type.startsWith(INTERNAL_MESSAGE_PREFIX)
  )
}

/**
 * Get message type from data
 */
export function getMessageType(data: unknown): string | undefined {
  const message = data as { type?: string }
  return message.type
}

/**
 * Create a typed internal message
 */
export function createInternalMessage<T extends Record<string, unknown>>(
  type: string,
  data?: Omit<T, 'type'>
): T {
  return { type, ...data } as unknown as T
}
