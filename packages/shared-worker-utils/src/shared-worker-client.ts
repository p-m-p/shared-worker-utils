import type { SharedWorkerClientOptions } from './types'

/**
 * Client-side SharedWorker connection manager
 * Handles visibility tracking, ping/pong responses, and cleanup
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class SharedWorkerClient<TMessage = unknown> {
  private port: MessagePort
  private onMessage: (message: TMessage) => void
  private onLog?: (message: string, ...args: unknown[]) => void
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

    this.log('Connected to SharedWorker')
    this.log(`Tab visibility: ${this.isTabVisible ? 'visible' : 'hidden'}`)
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
    this.send({ type: 'disconnect' })
  }

  /**
   * Check if the tab is currently visible
   */
  isVisible(): boolean {
    return this.isTabVisible
  }

  private setupMessageHandler(): void {
    this.port.onmessage = (event) => {
      const data: unknown = event.data
      const message = data as { type?: string }

      // Handle internal ping messages
      if (message.type === 'ping') {
        this.log('Received ping from SharedWorker, sending pong')
        this.send({ type: 'pong' })
        return
      }

      // Filter out other internal messages
      if (message.type && this.isInternalMessage(message.type)) {
        return
      }

      // Pass non-internal messages to the consumer
      this.onMessage(data as TMessage)
    }
  }

  private isInternalMessage(type: string): boolean {
    return (
      type === 'ping' ||
      type === 'pong' ||
      type === 'client-count' ||
      type === 'visibility-change' ||
      type === 'disconnect'
    )
  }

  private setupVisibilityHandler(): void {
    const handleVisibilityChange = () => {
      const wasVisible = this.isTabVisible
      this.isTabVisible = !document.hidden

      if (wasVisible !== this.isTabVisible) {
        this.log(
          `Tab visibility changed: ${this.isTabVisible ? 'visible' : 'hidden'}`
        )

        // Notify SharedWorker of visibility change
        this.send({
          type: 'visibility-change',
          visible: this.isTabVisible,
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.disconnect()
    })
  }

  private log(message: string, ...args: unknown[]): void {
    this.onLog?.(`[SharedWorkerClient] ${message}`, ...args)
  }
}
