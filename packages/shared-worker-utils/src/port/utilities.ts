/**
 * Internal message type prefix
 */
export const INTERNAL_MESSAGE_PREFIX = '@shared-worker-utils/'

/**
 * Internal message types
 */
export const MessageType = {
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
 * Normalize message data to ensure it has a type property
 */
export function normalizeMessage(data: unknown): { type?: string } {
  return data as { type?: string }
}
