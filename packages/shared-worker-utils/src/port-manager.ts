import { Logger } from './logger'
import { Broadcaster } from './port/broadcaster'
import { HeartbeatManager } from './port/heartbeat'
import { MessageHandler } from './port/message-handler'
import { PortRegistry } from './port/registry'
import type { PortManagerOptions } from './types'

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 * @template TMessage - The type of application messages (non-internal messages)
 */
export class PortManager<TMessage = unknown> extends Logger {
  private registry: PortRegistry<MessagePort>
  private broadcaster: Broadcaster<MessagePort>
  private messageHandler: MessageHandler<MessagePort, TMessage>
  private heartbeat: HeartbeatManager<MessagePort>
  private onActiveCountChange?: (
    activeCount: number,
    totalCount: number
  ) => void
  private onMessage?: (port: MessagePort, message: TMessage) => void

  constructor(options: PortManagerOptions<TMessage> = {}) {
    super()
    this.onActiveCountChange = options.onActiveCountChange
    this.onMessage = options.onMessage
    this.onLog = options.onLog

    // Initialize modules
    this.registry = new PortRegistry()
    this.broadcaster = new Broadcaster()
    this.messageHandler = new MessageHandler({
      onVisibilityChange: (port, visible) =>
        this.handleVisibilityChange(port, visible),
      onDisconnect: (port) => this.handleDisconnect(port),
      onPong: (port) => this.handlePong(port),
      onAppMessage: (port, message) => this.onMessage?.(port, message),
    })
    this.heartbeat = new HeartbeatManager(
      {
        pingInterval: options.pingInterval ?? 10_000,
        pingTimeout: options.pingTimeout ?? 5000,
      },
      {
        onStalePort: (port) => this.removeStalePort(port),
        onPing: (port) => this.sendPing(port),
      }
    )

    // Setup heartbeat interval
    this.heartbeat.onInterval(() => this.checkClients())

    this.log('PortManager initialized', 'info')
  }

  /**
   * Handle a new port connection
   */
  handleConnect(port: MessagePort): void {
    const controller = new AbortController()
    this.registry.register(port, {
      visible: true,
      lastPong: Date.now(),
      controller,
    })
    this.log('New client connected', 'info', {
      totalClients: this.registry.getTotal(),
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
    this.broadcaster.broadcast(this.registry.getPorts(), message)
  }

  /**
   * Get the number of active (visible) clients
   */
  getActiveCount(): number {
    return this.registry.getActiveCount()
  }

  /**
   * Get the total number of connected clients
   */
  getTotalCount(): number {
    return this.registry.getTotal()
  }

  private handleMessage(port: MessagePort, data: unknown): void {
    let client = this.registry.get(port)

    // Re-add client if it was removed (e.g., after computer sleep)
    if (!client) {
      this.log('Reconnecting previously removed client', 'info')
      const controller = new AbortController()
      client = { visible: true, lastPong: Date.now(), controller }
      this.registry.register(port, client)
      this.updateClientCount()
    }

    // Delegate to message handler
    this.messageHandler.handle(port, data)
  }

  private handleVisibilityChange(port: MessagePort, visible: boolean): void {
    this.registry.update(port, { visible })
    this.log('Client visibility changed', 'info', { visible })
    this.updateClientCount()
  }

  private handleDisconnect(port: MessagePort): void {
    const client = this.registry.get(port)
    client?.controller.abort()
    this.registry.remove(port)
    this.log('Client disconnected', 'info', {
      remainingClients: this.registry.getTotal(),
    })
    this.updateClientCount()
  }

  private handlePong(port: MessagePort): void {
    this.registry.update(port, { lastPong: Date.now() })
    this.log('Received pong from client', 'debug')
  }

  private sendPing(port: MessagePort): void {
    this.log('Sending ping to client', 'debug')
    this.broadcaster.send(port, { type: '@shared-worker-utils/ping' })
  }

  private removeStalePort(port: MessagePort): void {
    const client = this.registry.get(port)
    client?.controller.abort()
    this.registry.remove(port)
  }

  private checkClients(): void {
    const entries = this.registry.getEntries()
    const stalePorts = this.heartbeat.checkPorts(entries)

    // Update connection state if any ports were removed
    if (stalePorts.length > 0) {
      this.log('Removed stale client(s)', 'info', {
        removedCount: stalePorts.length,
        remainingClients: this.registry.getTotal(),
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
    this.broadcaster.broadcast(this.registry.getPorts(), {
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
    this.heartbeat.stop()
    // Abort all client controllers before clearing
    for (const [, client] of this.registry.getEntries()) {
      client.controller.abort()
    }
    this.registry.clear()
    this.log('PortManager destroyed', 'info')
  }
}
