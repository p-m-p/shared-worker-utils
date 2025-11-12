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
  lastMessage?: unknown

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener)
  }

  postMessage(data: unknown) {
    // Store sent messages for testing
    this.lastMessage = data
  }

  start() {
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
      message: '[PortManager] New client connected',
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

  it('should remove stale clients that do not respond to ping', () => {
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

    expect(portManager.getTotalCount()).toBe(0)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Removed stale client(s)',
      level: 'info',
      context: { removedCount: 1, remainingClients: 0 },
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

  it('should re-add client that sends message after being removed', () => {
    const onLog = vi.fn()
    const pingInterval = 5000
    const pingTimeout = 2000
    portManager = new PortManager({ pingInterval, pingTimeout, onLog })

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    // Advance to first ping, then past timeout and to next check to remove client
    vi.advanceTimersByTime(pingInterval)
    vi.advanceTimersByTime(pingTimeout + pingInterval)

    expect(portManager.getTotalCount()).toBe(0)

    // Client sends a message (e.g., after computer wakes from sleep)
    mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

    expect(portManager.getTotalCount()).toBe(1)
    expect(onLog).toHaveBeenCalledWith({
      message: '[PortManager] Reconnecting previously removed client',
      level: 'info',
    })
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

  it('should clean up on destroy', () => {
    portManager = new PortManager()

    mockPort = new MockMessagePort() as unknown as MessagePort
    portManager.handleConnect(mockPort as unknown as MessagePort)

    portManager.destroy()

    expect(portManager.getTotalCount()).toBe(0)
  })
})
