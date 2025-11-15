import type { PortEntry, PortRegistryOptions } from '../types'

/**
 * Event types for PortRegistry
 */
type RegistryEventType = 'add' | 'remove'

/**
 * Event listener callback
 */
type RegistryEventListener<TPort = MessagePort, TMeta = unknown> = (
  entry: PortEntry<TPort, TMeta>
) => void

/**
 * Registry for managing ports with lifecycle events
 * @template TPort - The type of port being managed (defaults to MessagePort)
 * @template TMeta - The type of metadata stored with each port (defaults to unknown)
 */
export class PortRegistry<TPort = MessagePort, TMeta = unknown> {
  private entries: Map<string, PortEntry<TPort, TMeta>> = new Map()
  private listeners: Map<
    RegistryEventType,
    Set<RegistryEventListener<TPort, TMeta>>
  > = new Map()

  constructor(_options?: PortRegistryOptions) {
    // Initialize event listener sets
    this.listeners.set('add', new Set())
    this.listeners.set('remove', new Set())
  }

  /**
   * Register a new port in the registry
   */
  register(portId: string, port: TPort, meta?: TMeta): void {
    const entry: PortEntry<TPort, TMeta> = { id: portId, port, meta }
    this.entries.set(portId, entry)
    this.emit('add', entry)
  }

  /**
   * Get a port by ID
   */
  get(portId: string): TPort | undefined {
    return this.entries.get(portId)?.port
  }

  /**
   * Get a full entry by ID
   */
  getEntry(portId: string): PortEntry<TPort, TMeta> | undefined {
    return this.entries.get(portId)
  }

  /**
   * Update metadata for a port
   */
  updateMeta(portId: string, meta: TMeta): boolean {
    const entry = this.entries.get(portId)
    if (!entry) {
      return false
    }
    entry.meta = meta
    return true
  }

  /**
   * Remove a port from the registry
   */
  remove(portId: string): boolean {
    const entry = this.entries.get(portId)
    if (!entry) {
      return false
    }
    this.entries.delete(portId)
    this.emit('remove', entry)
    return true
  }

  /**
   * List all registered ports
   */
  list(): Array<PortEntry<TPort, TMeta>> {
    return [...this.entries.values()]
  }

  /**
   * Get the number of registered ports
   */
  size(): number {
    return this.entries.size
  }

  /**
   * Check if a port is registered
   */
  has(portId: string): boolean {
    return this.entries.has(portId)
  }

  /**
   * Register an event listener
   */
  on(
    event: RegistryEventType,
    callback: RegistryEventListener<TPort, TMeta>
  ): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.add(callback)
    }
  }

  /**
   * Unregister an event listener
   */
  off(
    event: RegistryEventType,
    callback: RegistryEventListener<TPort, TMeta>
  ): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: RegistryEventType, entry: PortEntry<TPort, TMeta>): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        listener(entry)
      }
    }
  }

  /**
   * Shutdown the registry and clear all entries
   */
  async shutdown(): Promise<void> {
    // Emit remove events for all entries
    for (const entry of this.entries.values()) {
      this.emit('remove', entry)
    }
    this.entries.clear()
    // Clear all listeners
    for (const listeners of this.listeners.values()) {
      listeners.clear()
    }
  }
}
