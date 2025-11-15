import { Logger } from '../logger'
import type { PortEntry, PortRegistryOptions } from '../types'

type RegistryEventType = 'add' | 'remove'
type RegistryEventCallback<TPort> = (entry: PortEntry<TPort>) => void

/**
 * Manages a registry of ports with lifecycle operations
 * @template TPort - The type of port being managed (MessagePort or MessagePortLike)
 */
export class PortRegistry<TPort = MessagePort> extends Logger {
  private ports: Map<string, PortEntry<TPort>> = new Map()
  private listeners: Map<RegistryEventType, Set<RegistryEventCallback<TPort>>> =
    new Map([
      ['add', new Set()],
      ['remove', new Set()],
    ])

  constructor(options: PortRegistryOptions = {}) {
    super()
    this.onLog = options.onLog
  }

  /**
   * Register a new port in the registry
   */
  register(portId: string, port: TPort, meta?: Record<string, unknown>): void {
    const entry: PortEntry<TPort> = { id: portId, port, meta }
    this.ports.set(portId, entry)

    this.log(`Port registered: ${portId}`, 'debug', {
      totalPorts: this.ports.size,
    })

    this.emit('add', entry)
  }

  /**
   * Get a port by its ID
   */
  get(portId: string): TPort | undefined {
    return this.ports.get(portId)?.port
  }

  /**
   * Get a port entry by its ID (includes metadata)
   */
  getEntry(portId: string): PortEntry<TPort> | undefined {
    return this.ports.get(portId)
  }

  /**
   * Remove a port from the registry
   * @returns true if the port was removed, false if it didn't exist
   */
  remove(portId: string): boolean {
    const entry = this.ports.get(portId)
    if (!entry) {
      return false
    }

    this.ports.delete(portId)

    this.log(`Port removed: ${portId}`, 'debug', {
      remainingPorts: this.ports.size,
    })

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
   * Get the total number of registered ports
   */
  size(): number {
    return this.ports.size
  }

  /**
   * Register an event listener
   */
  on(event: RegistryEventType, callback: RegistryEventCallback<TPort>): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.add(callback)
    }
  }

  /**
   * Remove an event listener
   */
  off(event: RegistryEventType, callback: RegistryEventCallback<TPort>): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(event: RegistryEventType, entry: PortEntry<TPort>): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        callback(entry)
      }
    }
  }

  /**
   * Shutdown the registry and clear all ports
   */
  async shutdown(): Promise<void> {
    this.log('Shutting down registry', 'info', {
      totalPorts: this.ports.size,
    })

    // Emit remove events for all ports
    for (const entry of this.ports.values()) {
      this.emit('remove', entry)
    }

    this.ports.clear()
    this.listeners.clear()
  }

  protected getLogPrefix(): string {
    return '[PortRegistry]'
  }
}
