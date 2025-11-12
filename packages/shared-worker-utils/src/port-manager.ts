import type { PortManagerOptions, ClientState, LogEntry } from './types'

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class PortManager<TMessage = unknown> {
  private clients: Map<MessagePort, ClientState> = new Map()
  private pingInterval: number
  private pingTimeout: number
  private onActiveCountChange?: (
    activeCount: number,
    totalCount: number
  ) => void
  private onMessage?: (port: MessagePort, message: TMessage) => void
  private onLog?: (logEntry: LogEntry) => void
  private pingIntervalId: ReturnType<typeof setInterval>

  constructor(options: PortManagerOptions<TMessage> = {}) {
    this.pingInterval = options.pingInterval ?? 10_000
    this.pingTimeout = options.pingTimeout ?? 5000
    this.onActiveCountChange = options.onActiveCountChange
    this.onMessage = options.onMessage
    this.onLog = options.onLog

    // Start ping interval
    this.pingIntervalId = setInterval(
      () => this.checkClients(),
      this.pingInterval
    )

    this.log('PortManager initialized', 'info')
  }

  /**
   * Handle a new port connection
   */
  handleConnect(port: MessagePort): void {
    this.clients.set(port, { visible: true, lastPong: Date.now() })
    this.log('New client connected', 'info', {
      totalClients: this.clients.size,
    })

    this.updateClientCount()

    port.addEventListener('message', (event) => {
      this.handleMessage(port, event.data)
    })

    port.start()
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: unknown): void {
    for (const [port] of this.clients) {
      port.postMessage(message)
    }
  }

  /**
   * Get the number of active (visible) clients
   */
  getActiveCount(): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.visible) count++
    }
    return count
  }

  /**
   * Get the total number of connected clients
   */
  getTotalCount(): number {
    return this.clients.size
  }

  private handleMessage(port: MessagePort, data: unknown): void {
    let client = this.clients.get(port)

    // Re-add client if it was removed (e.g., after computer sleep)
    if (!client) {
      this.log('Reconnecting previously removed client', 'info')
      client = { visible: true, lastPong: Date.now() }
      this.clients.set(port, client)
      this.updateClientCount()
    }

    // Type guard for internal messages
    const message = data as { type?: string; visible?: boolean }

    switch (message.type) {
      case '@shared-worker-utils/visibility-change': {
        client.visible = message.visible ?? true
        this.log('Client visibility changed', 'info', {
          visible: message.visible,
        })
        this.updateClientCount()

        break
      }
      case '@shared-worker-utils/disconnect': {
        this.clients.delete(port)
        this.log('Client disconnected', 'info', {
          remainingClients: this.clients.size,
        })
        this.updateClientCount()

        break
      }
      case '@shared-worker-utils/pong': {
        client.lastPong = Date.now()
        this.log('Received pong from client', 'debug')

        break
      }
      default: {
        // Non-internal message - pass through to application
        this.onMessage?.(port, data as TMessage)
      }
    }
  }

  private checkClients(): void {
    const now = Date.now()
    let removedCount = 0
    const staleThreshold = this.pingInterval + this.pingTimeout

    for (const [port, client] of this.clients) {
      // Remove port if it hasn't responded to the last ping
      if (now - client.lastPong > staleThreshold) {
        this.clients.delete(port)
        removedCount++
      } else {
        // Send ping
        this.log('Sending ping to client', 'debug')
        port.postMessage({ type: '@shared-worker-utils/ping' })
      }
    }

    // Update connection state if any ports were removed
    if (removedCount > 0) {
      this.log('Removed stale client(s)', 'info', {
        removedCount,
        remainingClients: this.clients.size,
      })
      this.updateClientCount()
    }
  }

  private updateClientCount(): void {
    const activeCount = this.getActiveCount()
    const totalCount = this.getTotalCount()

    this.log('Active clients updated', 'debug', {
      activeCount,
      totalCount,
    })

    // Broadcast client count to all clients
    this.broadcast({
      type: '@shared-worker-utils/client-count',
      total: totalCount,
      active: activeCount,
    })

    // Notify callback
    this.onActiveCountChange?.(activeCount, totalCount)
  }

  private log(
    message: string,
    level: LogEntry['level'],
    context?: Record<string, unknown>
  ): void {
    this.onLog?.({
      message: `[PortManager] ${message}`,
      level,
      ...(context !== undefined && { context }),
    })
  }

  /**
   * Clean up resources (stop ping interval)
   */
  destroy(): void {
    clearInterval(this.pingIntervalId)
    this.clients.clear()
    this.log('PortManager destroyed', 'info')
  }
}
