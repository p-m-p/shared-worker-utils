import type { ClientState } from '../types'

/**
 * Manages the registration and lifecycle of MessagePort connections
 * Provides methods for registering, removing, and querying ports
 */
export class PortRegistry<TPort = MessagePort> {
  private clients: Map<TPort, ClientState> = new Map()

  /**
   * Register a new port with initial client state
   */
  register(port: TPort, state: ClientState): void {
    this.clients.set(port, state)
  }

  /**
   * Remove a port from the registry
   * @returns true if the port was removed, false if it didn't exist
   */
  remove(port: TPort): boolean {
    return this.clients.delete(port)
  }

  /**
   * Get the client state for a port
   * @returns ClientState if found, undefined otherwise
   */
  get(port: TPort): ClientState | undefined {
    return this.clients.get(port)
  }

  /**
   * Update the client state for a port
   */
  update(port: TPort, state: Partial<ClientState>): void {
    const existing = this.clients.get(port)
    if (existing) {
      this.clients.set(port, { ...existing, ...state })
    }
  }

  /**
   * Check if a port is registered
   */
  has(port: TPort): boolean {
    return this.clients.has(port)
  }

  /**
   * Get all registered ports
   */
  getPorts(): TPort[] {
    return [...this.clients.keys()]
  }

  /**
   * Get all port entries (port and state pairs)
   */
  getEntries(): Array<[TPort, ClientState]> {
    return [...this.clients.entries()]
  }

  /**
   * Get the total number of registered ports
   */
  getTotal(): number {
    return this.clients.size
  }

  /**
   * Get the number of active (visible) ports
   */
  getActiveCount(): number {
    let count = 0
    for (const client of this.clients.values()) {
      if (client.visible) count++
    }
    return count
  }

  /**
   * Clear all registered ports
   */
  clear(): void {
    this.clients.clear()
  }
}
