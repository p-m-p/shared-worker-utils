import type { ClientState } from '../types'

/**
 * Represents a single port connection with its state and lifecycle management
 * Handles message listening and state tracking for a connected port
 * @template TPort - The type of port (typically MessagePort)
 */
export class Connection<TPort = MessagePort> {
  private port: TPort
  private state: ClientState
  private messageHandler?: (port: TPort, data: unknown) => void

  constructor(
    port: TPort,
    options?: {
      visible?: boolean
      lastPong?: number
      onMessage?: (port: TPort, data: unknown) => void
    }
  ) {
    this.port = port
    const controller = new AbortController()
    this.state = {
      visible: options?.visible ?? true,
      lastPong: options?.lastPong ?? Date.now(),
      controller,
    }
    this.messageHandler = options?.onMessage

    // Set up message listener if handler provided
    if (this.messageHandler && this.isMessagePort(port)) {
      port.addEventListener(
        'message',
        (event) => {
          this.messageHandler?.(this.port, event.data)
        },
        { signal: controller.signal }
      )
    }
  }

  /**
   * Type guard to check if port is a MessagePort
   */
  private isMessagePort(port: unknown): port is MessagePort {
    return (
      typeof port === 'object' &&
      port !== null &&
      'addEventListener' in port &&
      'postMessage' in port
    )
  }

  /**
   * Get the port instance
   */
  getPort(): TPort {
    return this.port
  }

  /**
   * Get the current state of the connection
   */
  getState(): ClientState {
    return this.state
  }

  /**
   * Update the visibility state
   */
  setVisible(visible: boolean): void {
    this.state.visible = visible
  }

  /**
   * Check if the connection is visible
   */
  isVisible(): boolean {
    return this.state.visible
  }

  /**
   * Update the last pong timestamp
   */
  updateLastPong(): void {
    this.state.lastPong = Date.now()
  }

  /**
   * Get the last pong timestamp
   */
  getLastPong(): number {
    return this.state.lastPong
  }

  /**
   * Check if the connection is stale based on timeout threshold
   * @param thresholdMs - The timeout threshold in milliseconds
   * @returns true if connection is stale
   */
  isStale(thresholdMs: number): boolean {
    return Date.now() - this.state.lastPong > thresholdMs
  }

  /**
   * Start the port (if it's a MessagePort)
   */
  start(): void {
    if (this.isMessagePort(this.port)) {
      this.port.start()
    }
  }

  /**
   * Post a message to the port (if it supports postMessage)
   */
  postMessage(message: unknown): void {
    if (this.isMessagePort(this.port)) {
      this.port.postMessage(message)
    }
  }

  /**
   * Abort the connection and clean up resources
   */
  abort(): void {
    this.state.controller.abort()
  }

  /**
   * Get the AbortController for this connection
   */
  getController(): AbortController {
    return this.state.controller
  }
}
