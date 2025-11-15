import { Logger } from './logger'
import { PortRegistry } from './port/registry'
import { MESSAGE_TYPES, normalizeMessage } from './port/utilities'
import type { PortManagerOptions, ClientState } from './types'

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class PortManager<TMessage = unknown> extends Logger {
  private clients: Map<MessagePort, ClientState> = new Map()
  private registry: PortRegistry<MessagePort>
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

    // Initialize registry
    this.registry = new PortRegistry<MessagePort>({ onLog: options.onLog })

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
    const controller = new AbortController()
    this.clients.set(port, {
      visible: true,
      lastPong: Date.now(),
      controller,
    })
    this.log('New client connected', 'info', {
      totalClients: this.clients.size,
    })

    this.updateClientCount()

    port.addEventListener(
      'message',
      (event) => {
        this.handleMessage(port, event.data)
      },
      { signal: controller.signal }
    )

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
      const controller = new AbortController()
      client = { visible: true, lastPong: Date.now(), controller }
      this.clients.set(port, client)
      this.updateClientCount()
    }

    // Type guard for internal messages
    const message = normalizeMessage(data)

    switch (message.type) {
      case MESSAGE_TYPES.VISIBILITY_CHANGE: {
        client.visible = message.visible ?? true
        this.log('Client visibility changed', 'info', {
          visible: message.visible,
        })
        this.updateClientCount()

        break
      }
      case MESSAGE_TYPES.DISCONNECT: {
        const disconnectingClient = this.clients.get(port)
        disconnectingClient?.controller.abort()
        this.clients.delete(port)
        this.log('Client disconnected', 'info', {
          remainingClients: this.clients.size,
        })
        this.updateClientCount()

        break
      }
      case MESSAGE_TYPES.PONG: {
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
        client.controller.abort()
        this.clients.delete(port)
        removedCount++
      } else {
        // Send ping
        this.log('Sending ping to client', 'debug')
        port.postMessage({ type: MESSAGE_TYPES.PING })
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
      type: MESSAGE_TYPES.CLIENT_COUNT,
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
    // Abort all client controllers before clearing
    for (const client of this.clients.values()) {
      client.controller.abort()
    }
    this.clients.clear()
    this.log('PortManager destroyed', 'info')
  }
}
