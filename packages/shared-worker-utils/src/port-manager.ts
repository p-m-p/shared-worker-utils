import { Logger } from './logger'
import type { PortManagerOptions, ClientState } from './types'

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class PortManager<TMessage = unknown> extends Logger {
  private clients: Map<MessagePort, ClientState> = new Map()
  private pingInterval: number
  private pingTimeout: number
  private onActiveCountChange?: (
    activeCount: number,
    totalCount: number
  ) => void
  private onMessage?: (port: MessagePort, message: TMessage) => void
  private pingIntervalId: ReturnType<typeof setInterval>

  constructor(options: PortManagerOptions<TMessage> = {}) {
    super()
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
    this.addClient(port)
    this.updateClientCount()
    port.start()
  }

  /**
   * Add a client to the manager
   * Sets up the message listener and initializes client state
   */
  private addClient(port: MessagePort): void {
    const controller = new AbortController()
    this.clients.set(port, {
      visible: true,
      lastPong: Date.now(),
      controller,
      status: 'connected',
    })

    port.addEventListener(
      'message',
      (event) => {
        this.handleMessage(port, event.data)
      },
      { signal: controller.signal }
    )

    this.log('Client added', 'info', {
      totalClients: this.clients.size,
    })
  }

  /**
   * Remove a client from the manager
   * Aborts the message listener and removes from the clients map
   */
  private removeClient(port: MessagePort): void {
    const client = this.clients.get(port)
    if (client) {
      client.controller.abort()
      this.clients.delete(port)
      this.log('Client removed', 'info', {
        remainingClients: this.clients.size,
      })
    }
  }

  /**
   * Broadcast a message to all connected clients
   * Skips clients marked as stale
   */
  broadcast(message: unknown): void {
    for (const [port, client] of this.clients) {
      if (client.status === 'connected') {
        port.postMessage(message)
      }
    }
  }

  /**
   * Get the number of active (visible and connected) clients
   */
  getActiveCount(): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.visible && client.status === 'connected') count++
    }
    return count
  }

  /**
   * Get the total number of connected clients (excludes stale clients)
   */
  getTotalCount(): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.status === 'connected') count++
    }
    return count
  }

  private handleMessage(port: MessagePort, data: unknown): void {
    let client = this.clients.get(port)

    // Re-add client if it was removed (shouldn't happen in normal flow)
    if (!client) {
      this.log('Reconnecting previously removed client', 'info')
      this.addClient(port)
      client = this.clients.get(port)!
      this.updateClientCount()
    }

    // Restore stale clients to connected status when they send ANY message
    if (client.status === 'stale') {
      this.log('Restoring stale client to connected status', 'info')
      client.status = 'connected'
      client.lastPong = Date.now() // Reset lastPong to prevent immediate re-staling
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
        this.removeClient(port)
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
    let staleCount = 0
    const staleThreshold = this.pingInterval + this.pingTimeout

    for (const [port, client] of this.clients) {
      // Mark client as stale if it hasn't responded to the last ping
      if (now - client.lastPong > staleThreshold) {
        if (client.status === 'connected') {
          client.status = 'stale'
          staleCount++
          this.log('Marking client as stale', 'info')
        }
        // Don't send pings to stale clients
      } else if (client.status === 'connected') {
        // Only send pings to connected clients
        this.log('Sending ping to client', 'debug')
        port.postMessage({ type: '@shared-worker-utils/ping' })
      }
    }

    // Update connection state if any clients became stale
    if (staleCount > 0) {
      this.log('Marked client(s) as stale', 'info', {
        staleCount,
        connectedClients: this.getTotalCount(),
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

  protected getLogPrefix(): string {
    return '[PortManager]'
  }

  /**
   * Clean up resources (stop ping interval and abort all listeners)
   */
  destroy(): void {
    clearInterval(this.pingIntervalId)
    // Remove all clients (aborts controllers and clears map)
    const ports = [...this.clients.keys()]
    for (const port of ports) {
      this.removeClient(port)
    }
    this.log('PortManager destroyed', 'info')
  }
}
