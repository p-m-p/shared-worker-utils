import type { ClientState } from '../types'

/**
 * Registry for managing MessagePort connections and their metadata
 * Provides registration, lookup, and iteration over connected ports
 * @template TPort - The type of port (typically MessagePort)
 */
export class PortRegistry<TPort = MessagePort> {
  private ports: Map<TPort, ClientState> = new Map()

  /**
   * Register a new port with its metadata
   * @param port - The port to register
   * @param meta - Optional metadata for the port (defaults to initial state)
   * @returns The port that was registered
   */
  register(port: TPort, meta?: Partial<ClientState>): TPort {
    const controller = new AbortController()
    this.ports.set(port, {
      visible: meta?.visible ?? true,
      lastPong: meta?.lastPong ?? Date.now(),
      controller: meta?.controller ?? controller,
    })
    return port
  }

  /**
   * Unregister a port from the registry
   * @param port - The port to unregister
   * @returns true if the port was found and removed, false otherwise
   */
  unregister(port: TPort): boolean {
    const state = this.ports.get(port)
    if (state) {
      state.controller.abort()
      this.ports.delete(port)
      return true
    }
    return false
  }

  /**
   * Get the metadata for a port
   * @param port - The port to look up
   * @returns The metadata for the port, or undefined if not found
   */
  get(port: TPort): ClientState | undefined {
    return this.ports.get(port)
  }

  /**
   * Check if a port is registered
   * @param port - The port to check
   * @returns true if the port is registered
   */
  has(port: TPort): boolean {
    return this.ports.has(port)
  }

  /**
   * Get the total number of registered ports
   * @returns The total count of ports
   */
  size(): number {
    return this.ports.size
  }

  /**
   * Get the number of visible (active) ports
   * @returns The count of visible ports
   */
  countVisible(): number {
    let count = 0
    for (const state of this.ports.values()) {
      if (state.visible) count++
    }
    return count
  }

  /**
   * Iterate over all registered ports
   * @returns An iterator of [port, metadata] pairs
   */
  entries(): IterableIterator<[TPort, ClientState]> {
    return this.ports.entries()
  }

  /**
   * Iterate over all registered ports
   * @returns An iterator of ports
   */
  keys(): IterableIterator<TPort> {
    return this.ports.keys()
  }

  /**
   * Clear all ports from the registry
   * Aborts all controllers before clearing
   */
  clear(): void {
    for (const state of this.ports.values()) {
      state.controller.abort()
    }
    this.ports.clear()
  }
}
