import { Logger } from './logger'
import { PortRegistry } from './port/registry'
import type { PortManagerOptions } from './types'

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class PortManager<TMessage = unknown> extends Logger {
  private registry: PortRegistry<MessagePort> = new PortRegistry()
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
    this.registry.register(port)
    this.log('New client connected', 'info', {
      totalClients: this.registry.size(),
    })

    this.updateClientCount()

    const state = this.registry.get(port)
    if (state) {
      port.addEventListener(
        'message',
        (event) => {
          this.handleMessage(port, event.data)
        },
        { signal: state.controller.signal }
      )
    }

    port.start()
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: unknown): void {
    for (const [port] of this.registry.entries()) {
      port.postMessage(message)
    }
  }

  /**
   * Get the number of active (visible) clients
   */
  getActiveCount(): number {
    return this.registry.countVisible()
  }

  /**
   * Get the total number of connected clients
   */
  getTotalCount(): number {
    return this.registry.size()
  }

  private handleMessage(port: MessagePort, data: unknown): void {
    let client = this.registry.get(port)

    // Re-add client if it was removed (e.g., after computer sleep)
    if (!client) {
      this.log('Reconnecting previously removed client', 'info')
      this.registry.register(port)
      client = this.registry.get(port)
      this.updateClientCount()
    }

    // Type guard for internal messages
    const message = data as { type?: string; visible?: boolean }

    switch (message.type) {
      case '@shared-worker-utils/visibility-change': {
        if (client) {
          client.visible = message.visible ?? true
          this.log('Client visibility changed', 'info', {
            visible: message.visible,
          })
          this.updateClientCount()
        }

        break
      }
      case '@shared-worker-utils/disconnect': {
        this.registry.unregister(port)
        this.log('Client disconnected', 'info', {
          remainingClients: this.registry.size(),
        })
        this.updateClientCount()

        break
      }
      case '@shared-worker-utils/pong': {
        if (client) {
          client.lastPong = Date.now()
          this.log('Received pong from client', 'debug')
        }

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

    for (const [port, client] of this.registry.entries()) {
      // Remove port if it hasn't responded to the last ping
      if (now - client.lastPong > staleThreshold) {
        this.registry.unregister(port)
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
        remainingClients: this.registry.size(),
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
    this.registry.clear()
    this.log('PortManager destroyed', 'info')
  }
}
