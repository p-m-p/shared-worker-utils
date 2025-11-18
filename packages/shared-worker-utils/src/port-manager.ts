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
      lastSeen: Date.now(),
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
   * Update client's last seen timestamp
   */
  private updateLastSeen(client: ClientState): void {
    client.lastSeen = Date.now()
  }

  /**
   * Check if a client is connected (not stale)
   */
  private isConnected(client: ClientState): boolean {
    return client.status === 'connected'
  }

  /**
   * Get both active and total client counts in a single iteration
   */
  private getClientCounts(): { active: number; total: number } {
    let active = 0
    let total = 0
    for (const client of this.clients.values()) {
      if (this.isConnected(client)) {
        total++
        if (client.visible) active++
      }
    }
    return { active, total }
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
      if (this.isConnected(client)) {
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
      if (this.isConnected(client) && client.visible) count++
    }
    return count
  }

  /**
   * Get the total number of connected clients (excludes stale clients)
   */
  getTotalCount(): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (this.isConnected(client)) count++
    }
    return count
  }

  private handleMessage(port: MessagePort, data: unknown): void {
    const client = this.clients.get(port)
    if (!client) {
      // This should never happen - removed clients have their listeners aborted
      this.log('Received message from unknown client', 'error')
      return
    }

    // Restore stale clients to connected status when they send ANY message
    if (client.status === 'stale') {
      this.log('Restoring stale client to connected status', 'info')
      client.status = 'connected'
      this.updateLastSeen(client)
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
        this.updateLastSeen(client)
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
      const isStale = now - client.lastSeen > staleThreshold

      if (isStale && this.isConnected(client)) {
        client.status = 'stale'
        staleCount++
        this.log('Marking client as stale', 'info')
      } else if (!isStale && this.isConnected(client)) {
        this.log('Sending ping to client', 'debug')
        port.postMessage({ type: '@shared-worker-utils/ping' })
      }
    }

    if (staleCount > 0) {
      this.log('Marked client(s) as stale', 'info', {
        staleCount,
        connectedClients: this.getTotalCount(),
      })
      this.updateClientCount()
    }
  }

  private updateClientCount(): void {
    const { active, total } = this.getClientCounts()

    this.log('Active clients updated', 'debug', {
      activeCount: active,
      totalCount: total,
    })

    this.broadcast({
      type: '@shared-worker-utils/client-count',
      total,
      active,
    })

    this.onActiveCountChange?.(active, total)
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
