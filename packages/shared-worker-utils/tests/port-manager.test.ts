import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PortManager } from '../src/port-manager'

// Test message type
interface TestMessage {
  type: string
  data?: string
}

// Mock MessagePort
class MockMessagePort {
  private listeners = new Map<string, (event: MessageEvent) => void>()
  private signals = new Map<string, AbortSignal>()
  lastMessage?: unknown

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: { signal?: AbortSignal }
  ) {
    this.listeners.set(type, listener)
    if (options?.signal) {
      this.signals.set(type, options.signal)
      options.signal.addEventListener('abort', () => {
        this.listeners.delete(type)
        this.signals.delete(type)
      })
    }
  }

  postMessage(data: unknown) {
    // Store sent messages for testing
    this.lastMessage = data
  }

  start() {
    // No-op for mock
  }

  close() {
    // No-op for mock
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const listener = this.listeners.get('message')
    if (listener) {
      listener({ data } as MessageEvent)
    }
  }
}

describe('PortManager', () => {
  let portManager: PortManager<TestMessage>
  let mockPort: MockMessagePort

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    portManager?.destroy()
  })

  it('should initialize with default options', () => {
    portManager = new PortManager()
    expect(portManager.getTotalCount()).toBe(0)
    expect(portManager.getActiveCount()).toBe(0)
  })

  it('should handle new port connections', () => {
    const onLog = vi.fn()
    portManager = new PortManager({ onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    expect(portManager.getTotalCount()).toBe(1)
    expect(portManager.getActiveCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Client added',
      level: 'info',
      context: { totalClients: 1 },
    })
  })

  it('should broadcast client count on connect', () => {
    portManager = new PortManager()
    mockPort = new MockMessagePort() as unknown as MessagePort

    portManager.handleConnect(mockPort as unknown as MessagePort)

    expect((mockPort as unknown as MessagePort).lastMessage).toEqual({
      type: '@shared-worker-utils/client-count',
      total: 1,
      active: 1,
    })
  })

  it('should handle visibility change messages', () => {
    const onLog = vi.fn()
    portManager = new PortManager({ onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Change visibility to hidden
    mockPort.simulateMessage({
      type: '@shared-worker-utils/visibility-change',
      visible: false,
    })

    expect(portManager.getActiveCount()).toBe(0)
    expect(portManager.getTotalCount()).toBe(1)
  })

  it('should handle disconnect messages', () => {
    portManager = new PortManager()
    mockPort = new MockMessagePort() as unknown as MessagePort

    portManager.handleConnect(mockPort as unknown as MessagePort)
    expect(portManager.getTotalCount()).toBe(1)

    mockPort.simulateMessage({ type: '@shared-worker-utils/disconnect' })

    expect(portManager.getTotalCount()).toBe(0)
  })

  it('should broadcast messages to all clients', () => {
    portManager = new PortManager()

    const port1 = new MockMessagePort() as unknown as MessagePort
    const port2 = new MockMessagePort() as unknown as MessagePort

    portManager.handleConnect(port1)
    portManager.handleConnect(port2)

    const testMessage = { type: 'test', data: 'hello' }
    portManager.broadcast(testMessage)

    expect(port1.lastMessage).toEqual(testMessage)
    expect(port2.lastMessage).toEqual(testMessage)
  })

  it('should send ping messages on interval', () => {
    const onLog = vi.fn()
    portManager = new PortManager({ pingInterval: 5000, onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Clear initial messages
    ;(mockPort as unknown as MessagePort).lastMessage = undefined

    // Advance time to trigger ping
    vi.advanceTimersByTime(5000)

    expect((mockPort as unknown as MessagePort).lastMessage).toEqual({
      type: '@shared-worker-utils/ping',
    })
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Sending ping to client',
      level: 'debug',
    })
  })

  it('should handle pong responses', () => {
    const onLog = vi.fn()
    portManager = new PortManager({ onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Received pong from client',
      level: 'debug',
    })
  })

  it('should mark stale clients that do not respond to ping', () => {
    const onLog = vi.fn()
    const pingInterval = 10_000
    const pingTimeout = 5000

    portManager = new PortManager({ pingInterval, pingTimeout, onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    expect(portManager.getTotalCount()).toBe(1)

    // Advance time to trigger first ping
    vi.advanceTimersByTime(pingInterval)

    // Advance time past timeout without responding, then to next interval check
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    // Client should still exist but not be counted as connected
    expect(portManager.getTotalCount()).toBe(0)
    expect(portManager.getActiveCount()).toBe(0)
    expect(portManager.getStaleCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Client status update',
      level: 'info',
      context: { markedStale: 1, removed: 0, connectedClients: 0 },
    })
  })

  it('should not remove clients that respond to ping', () => {
    const pingInterval = 10_000
    const pingTimeout = 5000

    portManager = new PortManager({ pingInterval, pingTimeout })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to first ping
    vi.advanceTimersByTime(pingInterval)

    // Respond with pong
    mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

    // Advance past timeout
    vi.advanceTimersByTime(pingTimeout + 1000)

    // Client should still be connected
    expect(portManager.getTotalCount()).toBe(1)
  })

  it('should restore stale client when it sends pong', () => {
    const onLog = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000
    portManager = new PortManager({ pingInterval, pingTimeout, onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to first ping, then past timeout and to next check to mark client as stale
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    expect(portManager.getTotalCount()).toBe(0)

    // Client sends a pong (e.g., after computer wakes from sleep)
    mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

    // Client should be restored to connected status
    expect(portManager.getTotalCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Restoring stale client to connected status',
      level: 'info',
    })
  })

  it('should restore stale client when it sends any message', () => {
    const onLog = vi.fn()
    const onMessage = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000
    portManager = new PortManager({
      pingInterval,
      pingTimeout,
      onLog,
      onMessage,
    })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to first ping, then past timeout and to next check to mark client as stale
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    expect(portManager.getTotalCount()).toBe(0)
    expect(portManager.getActiveCount()).toBe(0)

    // Client sends a regular application message (not a pong)
    const appMessage = { type: 'custom', data: 'test' }
    mockPort.simulateMessage(appMessage)

    // Client should be restored to connected status
    expect(portManager.getTotalCount()).toBe(1)
    expect(portManager.getActiveCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Restoring stale client to connected status',
      level: 'info',
    })
    expect(onMessage).toHaveBeenCalledWith(mockPort, appMessage)

    // Verify client doesn't go stale again on next heartbeat
    vi.advanceTimersByTime(pingInterval)
    expect(portManager.getTotalCount()).toBe(1)
    expect(portManager.getActiveCount()).toBe(1)
  })

  it('should not broadcast to stale clients', () => {
    const pingInterval = 5000
    const pingTimeout = 2000
    portManager = new PortManager({ pingInterval, pingTimeout })

    const port1 = new MockMessagePort() as unknown as MessagePort
    const port2 = new MockMessagePort() as unknown as MessagePort

    portManager.handleConnect(port1)
    portManager.handleConnect(port2)

    // Make port1 stale by not responding to ping
    vi.advanceTimersByTime(pingInterval)

    // Only port2 responds
    ;(port2 as unknown as MockMessagePort).simulateMessage({
      type: '@shared-worker-utils/pong',
    })

    vi.advanceTimersByTime(pingTimeout + pingInterval)

    // port1 should now be stale
    expect(portManager.getTotalCount()).toBe(1)

    // Clear messages
    ;(port1 as unknown as MockMessagePort).lastMessage = undefined
    ;(port2 as unknown as MockMessagePort).lastMessage = undefined

    // Broadcast a message
    const testMessage = { type: 'test', data: 'hello' }
    portManager.broadcast(testMessage)

    // Only port2 should receive the message
    expect((port1 as unknown as MockMessagePort).lastMessage).toBeUndefined()
    expect((port2 as unknown as MockMessagePort).lastMessage).toEqual(
      testMessage
    )
  })

  it('should call onActiveCountChange callback', () => {
    const onActiveCountChange = vi.fn()
    portManager = new PortManager({ onActiveCountChange })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    expect(onActiveCountChange).toHaveBeenCalledWith(1, 1)

    mockPort.simulateMessage({
      type: '@shared-worker-utils/visibility-change',
      visible: false,
    })

    expect(onActiveCountChange).toHaveBeenCalledWith(0, 1)
  })

  it('should call onMessage for non-internal message types', () => {
    const onMessage = vi.fn()
    portManager = new PortManager({ onMessage })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    const customMessage = { type: 'custom', data: 'test' }
    mockPort.simulateMessage(customMessage)

    expect(onMessage).toHaveBeenCalledWith(mockPort, customMessage)
  })

  it('should auto-remove stale clients after staleClientTimeout', () => {
    const onLog = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000
    const staleClientTimeout = 10_000

    portManager = new PortManager({
      pingInterval,
      pingTimeout,
      staleClientTimeout,
      onLog,
    })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to first ping, then past timeout to mark as stale
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    // Client should be marked as stale
    expect(portManager.getTotalCount()).toBe(0)
    expect(portManager.getStaleCount()).toBe(1)

    // Advance time past the staleClientTimeout
    vi.advanceTimersByTime(staleClientTimeout + pingInterval)

    // Client should now be auto-removed
    expect(portManager.getStaleCount()).toBe(0)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Auto-removed stale client',
      level: 'info',
      context: expect.objectContaining({ timeStale: expect.any(Number) }),
    })
  })

  it('should not auto-remove stale clients when staleClientTimeout is not set', () => {
    const pingInterval = 5000
    const pingTimeout = 2000

    portManager = new PortManager({ pingInterval, pingTimeout })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to make client stale
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    // Client should be stale
    expect(portManager.getStaleCount()).toBe(1)

    // Advance time significantly
    vi.advanceTimersByTime(100_000)

    // Client should still be stale (not removed)
    expect(portManager.getStaleCount()).toBe(1)
  })

  it('should manually remove all stale clients with removeStaleClients()', () => {
    const onLog = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000

    portManager = new PortManager({ pingInterval, pingTimeout, onLog })

    const port1 = new MockMessagePort() as unknown as MessagePort
    const port2 = new MockMessagePort() as unknown as MessagePort
    const port3 = new MockMessagePort() as unknown as MessagePort

    portManager.handleConnect(port1)
    portManager.handleConnect(port2)
    portManager.handleConnect(port3)

    // Make port1 and port2 stale by not responding
    vi.advanceTimersByTime(pingInterval)

    // Only port3 responds
    ;(port3 as unknown as MockMessagePort).simulateMessage({
      type: '@shared-worker-utils/pong',
    })

    vi.advanceTimersByTime(pingTimeout + pingInterval)

    // Two clients should be stale, one connected
    expect(portManager.getStaleCount()).toBe(2)
    expect(portManager.getTotalCount()).toBe(1)

    // Manually remove stale clients
    const removedCount = portManager.removeStaleClients()

    // Should return count of removed clients
    expect(removedCount).toBe(2)
    expect(portManager.getStaleCount()).toBe(0)
    expect(portManager.getTotalCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Manually removed stale clients',
      level: 'info',
      context: { removedCount: 2 },
    })
  })

  it('should return 0 from removeStaleClients() when no stale clients exist', () => {
    portManager = new PortManager()

    const port1 = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(port1)

    // All clients are connected
    const removedCount = portManager.removeStaleClients()

    expect(removedCount).toBe(0)
    expect(portManager.getTotalCount()).toBe(1)
  })

  it('should clear staleTimestamp when stale client reconnects', () => {
    const onLog = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000
    const staleClientTimeout = 10_000

    portManager = new PortManager({
      pingInterval,
      pingTimeout,
      staleClientTimeout,
      onLog,
    })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Make client stale
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    expect(portManager.getStaleCount()).toBe(1)

    // Client reconnects by sending a message - this should clear staleTimestamp
    mockPort.simulateMessage({ type: 'custom', data: 'reconnect' })

    // Verify the restoration log
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Restoring stale client to connected status',
      level: 'info',
    })

    // Client should be connected again
    expect(portManager.getStaleCount()).toBe(0)
    expect(portManager.getTotalCount()).toBe(1)

    // Advance just a short time and verify client is still connected
    // (not immediately removed on next check)
    vi.advanceTimersByTime(pingInterval)

    // Client should receive a ping and should still be connected
    expect(portManager.getTotalCount()).toBe(1)

    // Respond to the ping
    mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

    // Advance well past the original staleClientTimeout
    // Keep responding to pings to verify staleTimestamp was truly cleared
    for (let index = 0; index < 3; index++) {
      vi.advanceTimersByTime(pingInterval)
      mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })
    }

    // Client should still be connected (staleTimestamp was cleared on reconnect)
    expect(portManager.getTotalCount()).toBe(1)
    expect(portManager.getStaleCount()).toBe(0)
  })

  it('should clean up on destroy', () => {
    portManager = new PortManager()

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    portManager.destroy()

    expect(portManager.getTotalCount()).toBe(0)
  })
})
