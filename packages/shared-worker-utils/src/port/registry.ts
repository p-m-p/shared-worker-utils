import { Logger } from '../logger'
import type { PortEntry, PortRegistryOptions } from '../types'

type EventType = 'add' | 'remove'
type EventCallback<TPort> = (entry: PortEntry<TPort>) => void

/**
 * Registry for managing MessagePort connections
 * Handles registration, lookup, removal, and lifecycle operations
 */
export class PortRegistry<TPort = MessagePort> extends Logger {
  private ports: Map<string, PortEntry<TPort>> = new Map()
  private eventListeners: Map<EventType, Set<EventCallback<TPort>>> = new Map()

  constructor(options: PortRegistryOptions = {}) {
    super()
    this.onLog = options.onLog
  }

  /**
   * Register a port with metadata
   */
  register(portId: string, port: TPort, meta?: PortEntry<TPort>['meta']): void {
    const entry: PortEntry<TPort> = { id: portId, port, meta }
    this.ports.set(portId, entry)
    this.log(`Port registered: ${portId}`, 'debug', { portId })
    this.emit('add', entry)
  }

  /**
   * Get a port by ID
   */
  get(portId: string): TPort | undefined {
    return this.ports.get(portId)?.port
  }

  /**
   * Get a full port entry by ID
   */
  getEntry(portId: string): PortEntry<TPort> | undefined {
    return this.ports.get(portId)
  }

  /**
   * Remove a port by ID
   */
  remove(portId: string): boolean {
    const entry = this.ports.get(portId)
    if (!entry) {
      return false
    }

    // Cleanup the controller if it exists in metadata
    if (entry.meta?.controller) {
      entry.meta.controller.abort()
    }

    this.ports.delete(portId)
    this.log(`Port removed: ${portId}`, 'debug', { portId })
    this.emit('remove', entry)
    return true
  }

  /**
   * List all port entries
   */
  list(): Array<PortEntry<TPort>> {
    return [...this.ports.values()]
  }

  /**
   * Get the number of registered ports
   */
  size(): number {
    return this.ports.size
  }

  /**
   * Register an event listener
   */
  on(event: EventType, callback: EventCallback<TPort>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback)
    }
  }

  /**
   * Emit an event
   */
  private emit(event: EventType, entry: PortEntry<TPort>): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        callback(entry)
      }
    }
  }

  /**
   * Shutdown the registry and cleanup all ports
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down registry', 'info', {
      portCount: this.ports.size,
    })

    // Remove all ports (which will trigger cleanup)
    for (const portId of this.ports.keys()) {
      this.remove(portId)
    }

    // Clear all event listeners
    this.eventListeners.clear()
  }

  protected getLogPrefix(): string {
    return '[PortRegistry]'
  }
}
