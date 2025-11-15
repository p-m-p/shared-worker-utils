import type { ClientState } from '../types'

/**
 * Configuration for heartbeat management
 */
export interface HeartbeatConfig {
  /**
   * Interval between ping messages in milliseconds
   */
  pingInterval: number

  /**
   * Maximum time to wait for pong response after ping in milliseconds
   */
  pingTimeout: number
}

/**
 * Manages ping/pong heartbeat mechanism for ports
 * Detects and removes stale connections
 */
export class HeartbeatManager<TPort = MessagePort> {
  private intervalId: ReturnType<typeof setInterval>
  private config: HeartbeatConfig
  private onStalePort?: (port: TPort) => void
  private onPing?: (port: TPort) => void

  constructor(
    config: HeartbeatConfig,
    callbacks: {
      onStalePort?: (port: TPort) => void
      onPing?: (port: TPort) => void
    }
  ) {
    this.config = config
    this.onStalePort = callbacks.onStalePort
    this.onPing = callbacks.onPing

    // Start the heartbeat interval
    this.intervalId = setInterval(() => this.check(), this.config.pingInterval)
  }

  /**
   * Start the heartbeat check
   * Called automatically on construction
   */
  private check(): void {
    // This will be triggered by the external code that has access to ports
  }

  /**
   * Check a list of ports and their states for staleness
   * Returns array of stale ports that should be removed
   */
  checkPorts(entries: Array<[TPort, ClientState]>): TPort[] {
    const now = Date.now()
    const staleThreshold = this.config.pingInterval + this.config.pingTimeout
    const stalePorts: TPort[] = []

    for (const [port, client] of entries) {
      // Check if port hasn't responded to the last ping
      if (now - client.lastPong > staleThreshold) {
        stalePorts.push(port)
        this.onStalePort?.(port)
      } else {
        // Send ping
        this.onPing?.(port)
      }
    }

    return stalePorts
  }

  /**
   * Get the interval ID for the heartbeat check
   * Used to trigger external check logic
   */
  onInterval(callback: () => void): void {
    clearInterval(this.intervalId)
    this.intervalId = setInterval(callback, this.config.pingInterval)
  }

  /**
   * Stop the heartbeat mechanism
   */
  stop(): void {
    clearInterval(this.intervalId)
  }
}
