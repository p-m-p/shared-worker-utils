import { Logger } from '../logger'
import type { ConnectionOptions, ConnectionState as State } from '../types'
import { ConnectionState } from '../types'

/**
 * Message event listener callback
 */
type MessageListener = (message: unknown, event?: MessageEvent) => void

/**
 * Close event listener callback
 */
type CloseListener = () => void

/**
 * Wrapper for a single MessagePort connection
 * Encapsulates message routing, handshake, error handling, and cleanup
 */
export class Connection extends Logger {
  private port: MessagePort
  private id: string
  private state: State
  private controller: AbortController
  private messageListeners: Set<MessageListener> = new Set()
  private closeListeners: Set<CloseListener> = new Set()

  constructor(port: MessagePort, id?: string, options?: ConnectionOptions) {
    super()
    this.port = port
    this.id = id ?? this.generateId()
    this.state = ConnectionState.CONNECTING
    this.controller = new AbortController()
    this.onLog = options?.onLog

    // Setup message listener
    this.port.addEventListener(
      'message',
      (event) => {
        this.handleMessage(event.data, event)
      },
      { signal: this.controller.signal }
    )

    // Auto-start unless explicitly disabled
    if (options?.autoStart !== false) {
      this.start()
    }
  }

  /**
   * Start the connection
   */
  start(): void {
    if (this.state !== ConnectionState.CONNECTING) {
      return
    }
    this.port.start()
    this.state = ConnectionState.CONNECTED
    this.log(`Connection ${this.id} started`, 'debug')
  }

  /**
   * Get the connection ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get the current state
   */
  getState(): State {
    return this.state
  }

  /**
   * Get the underlying port
   */
  getPort(): MessagePort {
    return this.port
  }

  /**
   * Send a message through the connection
   */
  send(message: unknown): void {
    if (this.state === ConnectionState.CLOSED) {
      this.log(`Cannot send message on closed connection ${this.id}`, 'warn')
      return
    }
    this.port.postMessage(message)
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.state === ConnectionState.CLOSED) {
      return
    }

    this.state = ConnectionState.CLOSED
    this.controller.abort()

    // Notify close listeners
    for (const listener of this.closeListeners) {
      listener()
    }

    // Clear listeners
    this.messageListeners.clear()
    this.closeListeners.clear()

    this.log(`Connection ${this.id} closed`, 'debug')
  }

  /**
   * Register a message listener
   */
  onMessage(callback: MessageListener): void {
    this.messageListeners.add(callback)
  }

  /**
   * Unregister a message listener
   */
  offMessage(callback: MessageListener): void {
    this.messageListeners.delete(callback)
  }

  /**
   * Register a close listener
   */
  onClose(callback: CloseListener): void {
    this.closeListeners.add(callback)
  }

  /**
   * Unregister a close listener
   */
  offClose(callback: CloseListener): void {
    this.closeListeners.delete(callback)
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: unknown, event: MessageEvent): void {
    // Notify all message listeners
    for (const listener of this.messageListeners) {
      listener(data, event)
    }
  }

  /**
   * Generate a unique connection ID
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  protected getLogPrefix(): string {
    return '[Connection]'
  }
}
