import { Logger } from '../logger'
import type { ConnectionOptions, ConnectionState } from '../types'
import { MESSAGE_TYPES, normalizeMessage } from './utilities'

type MessageCallback = (message: unknown, event?: MessageEvent) => void
type CloseCallback = () => void

/**
 * Wrapper for a single MessagePort connection
 * Handles message routing, handshake, error handling, and cleanup
 */
export class Connection extends Logger {
  private port: MessagePort
  private id: string
  private state: ConnectionState
  private controller: AbortController
  private messageCallbacks: Set<MessageCallback> = new Set()
  private closeCallbacks: Set<CloseCallback> = new Set()
  private autoStart: boolean

  constructor(port: MessagePort, id?: string, options: ConnectionOptions = {}) {
    super()
    this.port = port
    this.id = id ?? `port-${Date.now()}-${Math.random().toString(36).slice(2)}`
    this.state = 'connecting' as ConnectionState
    this.controller = new AbortController()
    this.onLog = options.onLog
    this.autoStart = options.autoStart ?? true

    this.setupPort()
  }

  /**
   * Get the connection ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get the current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Get the underlying port
   */
  getPort(): MessagePort {
    return this.port
  }

  /**
   * Send a message through the port
   */
  send(message: unknown): void {
    if (this.state === ('disconnected' as ConnectionState)) {
      this.log('Cannot send message: connection is disconnected', 'warn')
      return
    }

    try {
      this.port.postMessage(message)
      this.log('Message sent', 'debug', { message })
    } catch (error) {
      this.log('Error sending message', 'error', { error })
    }
  }

  /**
   * Register a callback for incoming messages
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.add(callback)
  }

  /**
   * Remove a message callback
   */
  offMessage(callback: MessageCallback): void {
    this.messageCallbacks.delete(callback)
  }

  /**
   * Register a callback for connection close
   */
  onClose(callback: CloseCallback): void {
    this.closeCallbacks.add(callback)
  }

  /**
   * Remove a close callback
   */
  offClose(callback: CloseCallback): void {
    this.closeCallbacks.delete(callback)
  }

  /**
   * Close the connection and clean up resources
   */
  close(): void {
    if (this.state === ('disconnected' as ConnectionState)) {
      return
    }

    this.log('Closing connection', 'info', { id: this.id })

    this.state = 'disconnected' as ConnectionState
    this.controller.abort()

    // Notify close callbacks
    for (const callback of this.closeCallbacks) {
      callback()
    }

    // Clear all callbacks
    this.messageCallbacks.clear()
    this.closeCallbacks.clear()
  }

  /**
   * Setup the port with message listener
   */
  private setupPort(): void {
    this.port.addEventListener(
      'message',
      (event) => {
        this.handleMessage(event)
      },
      { signal: this.controller.signal }
    )

    if (this.autoStart) {
      this.port.start()
      this.state = 'connected' as ConnectionState
      this.log('Connection established', 'info', { id: this.id })
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    const data = normalizeMessage(event.data)

    this.log('Message received', 'debug', { data })

    // Notify all message callbacks
    for (const callback of this.messageCallbacks) {
      callback(data, event)
    }
  }

  protected getLogPrefix(): string {
    return `[Connection:${this.id}]`
  }

  /**
   * Helper to send internal messages
   */
  sendInternal(
    type: keyof typeof MESSAGE_TYPES,
    data?: Record<string, unknown>
  ): void {
    this.send({ type: MESSAGE_TYPES[type], ...data })
  }
}
