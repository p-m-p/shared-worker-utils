import { MESSAGE_TYPES } from './constants'
import { Logger } from './logger'
import type { SharedWorkerClientOptions } from './types'

/**
 * Client-side SharedWorker connection manager
 * Handles visibility tracking, ping/pong responses, and cleanup
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class SharedWorkerClient<TMessage = unknown> extends Logger {
  private port: MessagePort
  private onMessage: (message: TMessage) => void
  private isTabVisible: boolean
  private abortController = new AbortController()

  constructor(
    worker: SharedWorker,
    options: SharedWorkerClientOptions<TMessage>
  ) {
    super()
    this.port = worker.port
    this.onMessage = options.onMessage
    this.onLog = options.onLog
    this.isTabVisible = this.getDocumentVisibility()

    this.setupMessageHandler()
    this.setupVisibilityHandler()
    this.setupUnloadHandler()

    this.port.start()

    this.log('Connected to SharedWorker', 'info')
    this.log('Tab visibility initialized', 'info', {
      visible: this.isTabVisible,
    })
  }

  /**
   * Get current document visibility state
   */
  private getDocumentVisibility(): boolean {
    return !document.hidden
  }

  /**
   * Send an internal message to the SharedWorker
   */
  private sendInternal(type: string, data?: Record<string, unknown>): void {
    this.send({ type, ...data })
  }

  /**
   * Send a message to the SharedWorker
   */
  send(message: unknown): void {
    this.port.postMessage(message)
  }

  /**
   * Disconnect from the SharedWorker
   */
  disconnect(): void {
    this.sendInternal(MESSAGE_TYPES.DISCONNECT)
    this.destroy()
  }

  /**
   * Clean up event listeners and close the port
   */
  destroy(): void {
    this.abortController.abort()
    this.port.close()
    this.log('SharedWorkerClient destroyed', 'info')
  }

  /**
   * Check if the tab is currently visible
   */
  getIsVisible(): boolean {
    return this.isTabVisible
  }

  private handleMessage = (event: MessageEvent): void => {
    const message = event.data as { type?: string }

    // Handle internal ping messages
    if (message.type === MESSAGE_TYPES.PING) {
      this.log('Received ping from SharedWorker, sending pong', 'debug')
      this.sendInternal(MESSAGE_TYPES.PONG)
      return
    }

    // Filter out other internal messages
    if (
      message.type &&
      Object.values(MESSAGE_TYPES).includes(
        message.type as (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]
      )
    ) {
      return
    }

    // Pass non-internal messages to the consumer
    this.onMessage(event.data as TMessage)
  }

  private setupMessageHandler(): void {
    this.port.addEventListener('message', this.handleMessage, {
      signal: this.abortController.signal,
    })
  }

  private handleVisibilityChange = (): void => {
    const newVisibility = this.getDocumentVisibility()

    if (newVisibility !== this.isTabVisible) {
      this.isTabVisible = newVisibility
      this.log('Tab visibility changed', 'info', {
        visible: this.isTabVisible,
      })

      this.sendInternal(MESSAGE_TYPES.VISIBILITY_CHANGE, {
        visible: this.isTabVisible,
      })
    }
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange, {
      signal: this.abortController.signal,
    })
  }

  private setupUnloadHandler(): void {
    window.addEventListener(
      'beforeunload',
      () => {
        this.disconnect()
      },
      { signal: this.abortController.signal }
    )
  }

  protected getLogPrefix(): string {
    return '[SharedWorkerClient]'
  }
}
