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
   * Callback when active or total client count changes
   */
  onActiveCountChange?: (activeCount: number, totalCount: number) => void

  /**
   * Callback for non-internal messages from clients
   * Internal messages (ping, pong, visibility-change, disconnect, client-count) are filtered out
   */
  onMessage?: (port: MessagePort, message: TMessage) => void

  /**
   * Callback for internal logging
   */
  onLog?: (message: string, ...args: unknown[]) => void
}

export interface SharedWorkerClientOptions<TMessage = unknown> {
  /**
   * Callback for non-internal messages from SharedWorker
   * Internal messages (ping, pong, visibility-change, disconnect, client-count) are filtered out
   */
  onMessage: (message: TMessage) => void

  /**
   * Callback for internal logging
   */
  onLog?: (message: string, ...args: unknown[]) => void
}

export interface ClientState {
  visible: boolean
  lastPong: number
}

export interface ClientCountMessage {
  type: 'client-count'
  total: number
  active: number
}

export interface VisibilityChangeMessage {
  type: 'visibility-change'
  visible: boolean
}

export interface DisconnectMessage {
  type: 'disconnect'
}

export interface PingMessage {
  type: 'ping'
}

export interface PongMessage {
  type: 'pong'
}

export type InternalMessage =
  | ClientCountMessage
  | VisibilityChangeMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage
