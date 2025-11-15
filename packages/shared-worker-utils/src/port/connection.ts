import { Logger } from '../logger'
import type { ConnectionOptions, ConnectionState } from '../types'
import { MessageType, normalizeMessage } from './utilities'

type MessageCallback = (message: unknown, event?: MessageEvent) => void
type CloseCallback = () => void

/**
 * MessagePort-like interface for environments without exact DOM MessagePort
 */
export interface MessagePortLike {
  postMessage(message: unknown): void
  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: { signal?: AbortSignal }
  ): void
  start?(): void
}

/**
 * Wrapper for a single MessagePort connection
 * Handles message routing, handshake, error handling, and cleanup
 */
export class Connection extends Logger {
  private port: MessagePortLike
  private id: string
  private state: ConnectionState = 'connecting'
  private controller: AbortController
  private messageCallbacks: Set<MessageCallback> = new Set()
  private closeCallbacks: Set<CloseCallback> = new Set()

  constructor(
    port: MessagePort | MessagePortLike,
    id?: string,
    options: ConnectionOptions = {}
  ) {
    super()
    this.port = port
    this.id = id ?? this.generateId()
    this.controller = new AbortController()
    this.onLog = options.onLog

    this.setupMessageListener()
    this.state = 'connected'
    this.log(`Connection established: ${this.id}`, 'debug', { id: this.id })
  }

  /**
   * Get the connection ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get the connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Get the underlying port
   */
  getPort(): MessagePortLike {
    return this.port
  }

  /**
   * Send a message through the connection
   */
  send(message: unknown): void {
    if (this.state === 'closed' || this.state === 'closing') {
      this.log('Cannot send message on closed connection', 'warn', {
        id: this.id,
      })
      return
    }

    this.port.postMessage(message)
  }

  /**
   * Register a message handler
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  /**
   * Register a close handler
   */
  onClose(callback: CloseCallback): () => void {
    this.closeCallbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.closeCallbacks.delete(callback)
    }
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.state === 'closed' || this.state === 'closing') {
      return
    }

    this.state = 'closing'
    this.log(`Closing connection: ${this.id}`, 'debug', { id: this.id })

    // Abort the message listener
    this.controller.abort()

    // Notify close callbacks
    for (const callback of this.closeCallbacks) {
      try {
        callback()
      } catch (error) {
        this.log('Error in close callback', 'error', { error })
      }
    }

    // Clear callbacks
    this.messageCallbacks.clear()
    this.closeCallbacks.clear()

    this.state = 'closed'
  }

  /**
   * Setup message listener
   */
  private setupMessageListener(): void {
    this.port.addEventListener(
      'message',
      (event: MessageEvent) => {
        this.handleMessage(event.data, event)
      },
      { signal: this.controller.signal }
    )

    // Start the port if it has a start method
    if (typeof this.port.start === 'function') {
      this.port.start()
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: unknown, event: MessageEvent): void {
    const message = normalizeMessage(data)

    // Handle pong internally for logging
    if (message.type === MessageType.PONG) {
      this.log('Received pong', 'debug', { id: this.id })
    }

    // Dispatch to all message callbacks
    for (const callback of this.messageCallbacks) {
      try {
        callback(data, event)
      } catch (error) {
        this.log('Error in message callback', 'error', { error })
      }
    }
  }

  /**
   * Generate a random connection ID
   */
  private generateId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  protected getLogPrefix(): string {
    return '[Connection]'
  }
}
