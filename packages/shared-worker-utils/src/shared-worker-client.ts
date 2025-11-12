import type { SharedWorkerClientOptions, LogEntry } from './types'

/**
 * Client-side SharedWorker connection manager
 * Handles visibility tracking, ping/pong responses, and cleanup
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class SharedWorkerClient<TMessage = unknown> {
  private port: MessagePort
  private onMessage: (message: TMessage) => void
  private onLog?: (logEntry: LogEntry) => void
  private isTabVisible: boolean

  constructor(
    worker: SharedWorker,
    options: SharedWorkerClientOptions<TMessage>
  ) {
    this.port = worker.port
    this.onMessage = options.onMessage
    this.onLog = options.onLog
    this.isTabVisible = !document.hidden

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
   * Send a message to the SharedWorker
   */
  send(message: unknown): void {
    this.port.postMessage(message)
  }

  /**
   * Disconnect from the SharedWorker
   */
  disconnect(): void {
    this.send({ type: '@shared-worker-utils/disconnect' })
  }

  /**
   * Check if the tab is currently visible
   */
  isVisible(): boolean {
    return this.isTabVisible
  }

  private handleMessage = (event: MessageEvent): void => {
    const data: unknown = event.data
    const message = data as { type?: string }

    // Handle internal ping messages
    if (message.type === '@shared-worker-utils/ping') {
      this.log('Received ping from SharedWorker, sending pong', 'debug')
      this.send({ type: '@shared-worker-utils/pong' })
      return
    }

    // Filter out other internal messages
    if (message.type && this.isInternalMessage(message.type)) {
      return
    }

    // Pass non-internal messages to the consumer
    this.onMessage(data as TMessage)
  }

  private setupMessageHandler(): void {
    this.port.addEventListener('message', this.handleMessage)
  }

  private isInternalMessage(type: string): boolean {
    return type.startsWith('@shared-worker-utils/')
  }

  private handleVisibilityChange = (): void => {
    const wasVisible = this.isTabVisible
    this.isTabVisible = !document.hidden

    if (wasVisible !== this.isTabVisible) {
      this.log('Tab visibility changed', 'info', {
        visible: this.isTabVisible,
      })

      // Notify SharedWorker of visibility change
      this.send({
        type: '@shared-worker-utils/visibility-change',
        visible: this.isTabVisible,
      })
    }
  }

  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.disconnect()
    })
  }

  private log(
    message: string,
    level: LogEntry['level'],
    context?: Record<string, unknown>
  ): void {
    this.onLog?.({
      message: `[SharedWorkerClient] ${message}`,
      level,
      context,
    })
  }
}
