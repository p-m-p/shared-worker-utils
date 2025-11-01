import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SharedWorkerClient } from '../src/shared-worker-client'

// Test message type
interface TestMessage {
  type: string
  data?: string
}

// Mock MessagePort for SharedWorker
class MockPort {
  private listeners = new Map<string, (event: MessageEvent) => void>()
  private messages: unknown[] = []

  postMessage(data: unknown) {
    this.messages.push(data)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener)
  }

  start() {
    // No-op for mock
  }

  // Test helper to get last sent message
  getLastMessage() {
    return this.messages.at(-1)
  }

  // Test helper to get all messages
  getAllMessages() {
    return this.messages
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const listener = this.listeners.get('message')
    if (listener) {
      listener({ data } as MessageEvent)
    }
  }
}

// Mock SharedWorker
class MockSharedWorker {
  port = new MockPort()
}

// Mock document
const mockDocument = {
  hidden: false,
  listeners: new Map<string, () => void>(),
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener)
  },
  simulateVisibilityChange(hidden: boolean) {
    this.hidden = hidden
    const listener = this.listeners.get('visibilitychange')
    if (listener) {
      listener()
    }
  },
}

// Mock window
const mockWindow = {
  listeners: new Map<string, () => void>(),
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener)
  },
  simulateBeforeUnload() {
    const listener = this.listeners.get('beforeunload')
    if (listener) {
      listener()
    }
  },
}

describe('SharedWorkerClient', () => {
  let mockWorker: MockSharedWorker
  let portWrapper: SharedWorkerClient<TestMessage>

  beforeEach(() => {
    mockWorker = new MockSharedWorker()
    // Override global document and window
    ;(globalThis as unknown as { document: typeof mockDocument }).document =
      mockDocument
    ;(globalThis as unknown as { window: typeof mockWindow }).window =
      mockWindow
    mockDocument.hidden = false
    mockDocument.listeners.clear()
    mockWindow.listeners.clear()
  })

  it('should initialize and start the port', () => {
    const onMessage = vi.fn()
    const onLog = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage, onLog }
    )

    expect(onLog).toHaveBeenCalledWith(
      '[SharedWorkerClient] Connected to SharedWorker'
    )
    expect(onLog).toHaveBeenCalledWith(
      '[SharedWorkerClient] Tab visibility: visible'
    )
  })

  it('should report correct initial visibility', () => {
    mockDocument.hidden = true
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    expect(portWrapper.isVisible()).toBe(false)
  })

  it('should respond to ping messages with pong', () => {
    const onMessage = vi.fn()
    const onLog = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage, onLog }
    )

    mockWorker.port.simulateMessage({ type: 'ping' })

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual({ type: 'pong' })
    expect(onLog).toHaveBeenCalledWith(
      '[SharedWorkerClient] Received ping from SharedWorker, sending pong'
    )
  })

  it('should pass non-internal messages to onMessage callback', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    const testMessage = { type: 'test', data: 'hello' }
    mockWorker.port.simulateMessage(testMessage)

    expect(onMessage).toHaveBeenCalledWith(testMessage)
  })

  it('should filter out internal messages', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    // Send various internal messages
    mockWorker.port.simulateMessage({ type: 'ping' })
    mockWorker.port.simulateMessage({ type: 'pong' })
    mockWorker.port.simulateMessage({
      type: 'client-count',
      total: 2,
      active: 1,
    })
    mockWorker.port.simulateMessage({
      type: 'visibility-change',
      visible: true,
    })
    mockWorker.port.simulateMessage({ type: 'disconnect' })

    // onMessage should not have been called for any internal messages
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('should send messages via send()', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    const testMessage = { type: 'custom', data: 'test' }
    portWrapper.send(testMessage)

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual(testMessage)
  })

  it('should send visibility change when tab becomes hidden', () => {
    const onMessage = vi.fn()
    const onLog = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage, onLog }
    )

    // Clear initial messages
    mockWorker.port.getAllMessages().length = 0

    // Simulate tab becoming hidden
    mockDocument.simulateVisibilityChange(true)

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual({
      type: 'visibility-change',
      visible: false,
    })
    expect(portWrapper.isVisible()).toBe(false)
    expect(onLog).toHaveBeenCalledWith(
      '[SharedWorkerClient] Tab visibility changed: hidden'
    )
  })

  it('should send visibility change when tab becomes visible', () => {
    mockDocument.hidden = true
    const onMessage = vi.fn()
    const onLog = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage, onLog }
    )

    expect(portWrapper.isVisible()).toBe(false)

    // Clear initial messages
    mockWorker.port.getAllMessages().length = 0

    // Simulate tab becoming visible
    mockDocument.simulateVisibilityChange(false)

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual({
      type: 'visibility-change',
      visible: true,
    })
    expect(portWrapper.isVisible()).toBe(true)
    expect(onLog).toHaveBeenCalledWith(
      '[SharedWorkerClient] Tab visibility changed: visible'
    )
  })

  it('should not send visibility change if visibility does not actually change', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    const initialMessageCount = mockWorker.port.getAllMessages().length

    // Simulate visibility change event but hidden state is the same
    mockDocument.simulateVisibilityChange(false)

    expect(mockWorker.port.getAllMessages().length).toBe(initialMessageCount)
  })

  it('should send disconnect message on beforeunload', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    mockWindow.simulateBeforeUnload()

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual({ type: 'disconnect' })
  })

  it('should send disconnect message when disconnect() is called', () => {
    const onMessage = vi.fn()

    portWrapper = new SharedWorkerClient(
      mockWorker as unknown as SharedWorker,
      { onMessage }
    )

    portWrapper.disconnect()

    const lastMessage = mockWorker.port.getLastMessage()
    expect(lastMessage).toEqual({ type: 'disconnect' })
  })

  it('should work without onLog callback', () => {
    const onMessage = vi.fn()

    expect(() => {
      portWrapper = new SharedWorkerClient(
        mockWorker as unknown as SharedWorker,
        { onMessage }
      )
    }).not.toThrow()
  })
})
