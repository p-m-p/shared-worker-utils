/**
 * Log levels for structured logging
 */
export type LogLevel = 'info' | 'debug' | 'warn' | 'error'

/**
 * Structured log entry
 */
export interface LogEntry {
  /**
   * The log message
   */
  message: string

  /**
   * The log level
   */
  level: LogLevel

  /**
   * Optional context data
   */
  context?: Record<string, unknown>
}

export interface PortManagerOptions<TMessage = unknown> {
  /**
   * Interval between ping messages in milliseconds
   * @default 10000
   */
  pingInterval?: number

  /**
   * Maximum time to wait for pong response after ping in milliseconds
   * @default 5000
   */
  pingTimeout?: number

  /**
   * Auto-remove stale clients after this many milliseconds
   * @default undefined (no auto-removal)
   */
  staleClientTimeout?: number

  /**
   * Callback when active or total client count changes
   */
  onActiveCountChange?: (activeCount: number, totalCount: number) => void

  /**
   * Callback for non-internal messages from clients
   * Internal messages (prefixed with @shared-worker-utils/) are filtered out
   */
  onMessage?: (port: MessagePort, message: TMessage) => void

  /**
   * Callback for internal logging with structured log entries
   */
  onLog?: (logEntry: LogEntry) => void
}

export interface SharedWorkerClientOptions<TMessage = unknown> {
  /**
   * Callback for non-internal messages from SharedWorker
   * Internal messages (prefixed with @shared-worker-utils/) are filtered out
   */
  onMessage: (message: TMessage) => void

  /**
   * Callback for internal logging with structured log entries
   */
  onLog?: (logEntry: LogEntry) => void
}

export type ClientStatus = 'connected' | 'stale'

export interface ClientState {
  visible: boolean
  lastSeen: number
  controller: AbortController
  status: ClientStatus
  staleTimestamp?: number
}

export interface ClientCountMessage {
  type: '@shared-worker-utils/client-count'
  total: number
  active: number
}

export interface VisibilityChangeMessage {
  type: '@shared-worker-utils/visibility-change'
  visible: boolean
}

export interface DisconnectMessage {
  type: '@shared-worker-utils/disconnect'
}

export interface PingMessage {
  type: '@shared-worker-utils/ping'
}

export interface PongMessage {
  type: '@shared-worker-utils/pong'
}

export type InternalMessage =
  | ClientCountMessage
  | VisibilityChangeMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage
