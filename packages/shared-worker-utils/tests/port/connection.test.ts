import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection } from '../../src/port/connection'

// Mock MessagePort
class MockMessagePort {
  private listeners = new Map<string, (event: MessageEvent) => void>()
  private abortSignal?: AbortSignal
  lastMessage?: unknown

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: { signal?: AbortSignal }
  ) {
    this.listeners.set(type, listener)
    this.abortSignal = options?.signal
  }

  postMessage(data: unknown) {
    this.lastMessage = data
  }

  start() {
    // No-op for mock
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const listener = this.listeners.get('message')
    if (listener && !this.abortSignal?.aborted) {
      listener({ data } as MessageEvent)
    }
  }

  // Test helper to check if aborted
  isAborted(): boolean {
    return this.abortSignal?.aborted ?? false
  }
}

describe('Connection', () => {
  let mockPort: MockMessagePort
  let connection: Connection

  beforeEach(() => {
    mockPort = new MockMessagePort()
  })

  describe('constructor', () => {
    it('should create a connection with auto-generated ID', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.getId()).toMatch(/^conn-\d+-[a-z0-9]+$/)
      expect(connection.getState()).toBe('connected')
    })

    it('should create a connection with custom ID', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        'custom-id'
      )

      expect(connection.getId()).toBe('custom-id')
    })

    it('should start the port', () => {
      const startSpy = vi.spyOn(mockPort, 'start')
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(startSpy).toHaveBeenCalled()
    })

    it('should setup message listener', () => {
      const addEventListenerSpy = vi.spyOn(mockPort, 'addEventListener')
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  describe('getId', () => {
    it('should return the connection ID', () => {
      connection = new Connection(mockPort as unknown as MessagePort, 'test-id')

      expect(connection.getId()).toBe('test-id')
    })
  })

  describe('getState', () => {
    it('should return "connected" after construction', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.getState()).toBe('connected')
    })

    it('should return "closing" when closing', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      connection.close()

      expect(connection.getState()).toBe('closed')
    })
  })

  describe('getPort', () => {
    it('should return the underlying port', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.getPort()).toBe(mockPort)
    })
  })

  describe('send', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should send a message through the port', () => {
      const message = { type: 'test', data: 'hello' }
      connection.send(message)

      expect(mockPort.lastMessage).toBe(message)
    })

    it('should not send when connection is closed', () => {
      const onLog = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, 'id', {
        onLog,
      })

      connection.close()
      mockPort.lastMessage = undefined

      connection.send({ type: 'test' })

      expect(mockPort.lastMessage).toBeUndefined()
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Cannot send message on closed'),
          level: 'warn',
        })
      )
    })
  })

  describe('onMessage', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should call callback when message received', () => {
      const callback = vi.fn()
      connection.onMessage(callback)

      const message = { type: 'test', data: 'hello' }
      mockPort.simulateMessage(message)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(message, expect.any(Object))
    })

    it('should support multiple message callbacks', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      connection.onMessage(callback1)
      connection.onMessage(callback2)

      const message = { type: 'test' }
      mockPort.simulateMessage(message)

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = connection.onMessage(callback)

      mockPort.simulateMessage({ type: 'test' })
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()
      mockPort.simulateMessage({ type: 'test' })
      expect(callback).toHaveBeenCalledTimes(1) // Not called again
    })

    it('should handle pong messages', () => {
      const onLog = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, 'id', {
        onLog,
      })

      mockPort.simulateMessage({ type: '@shared-worker-utils/pong' })

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Received pong'),
          level: 'debug',
        })
      )
    })

    it('should catch and log errors in message callbacks', () => {
      const onLog = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, 'id', {
        onLog,
      })

      const errorCallback = vi.fn(() => {
        throw new Error('Test error')
      })
      connection.onMessage(errorCallback)

      mockPort.simulateMessage({ type: 'test' })

      expect(errorCallback).toHaveBeenCalled()
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Error in message callback'),
          level: 'error',
        })
      )
    })
  })

  describe('onClose', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should call callback when connection is closed', () => {
      const callback = vi.fn()
      connection.onClose(callback)

      connection.close()

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should support multiple close callbacks', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      connection.onClose(callback1)
      connection.onClose(callback2)

      connection.close()

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = connection.onClose(callback)

      unsubscribe()
      connection.close()

      expect(callback).not.toHaveBeenCalled()
    })

    it('should catch and log errors in close callbacks', () => {
      const onLog = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, 'id', {
        onLog,
      })

      const errorCallback = vi.fn(() => {
        throw new Error('Test error')
      })
      connection.onClose(errorCallback)

      connection.close()

      expect(errorCallback).toHaveBeenCalled()
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Error in close callback'),
          level: 'error',
        })
      )
    })
  })

  describe('close', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should change state to closing then closed', () => {
      connection.close()

      expect(connection.getState()).toBe('closed')
    })

    it('should abort the message listener', () => {
      connection.close()

      expect(mockPort.isAborted()).toBe(true)
    })

    it('should clear message callbacks', () => {
      const callback = vi.fn()
      connection.onMessage(callback)

      connection.close()

      mockPort.simulateMessage({ type: 'test' })
      expect(callback).not.toHaveBeenCalled()
    })

    it('should clear close callbacks after calling them', () => {
      const callback = vi.fn()
      connection.onClose(callback)

      connection.close()
      expect(callback).toHaveBeenCalledTimes(1)

      // Trying to close again should not call callbacks again
      connection.close()
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should be idempotent', () => {
      connection.close()
      const state1 = connection.getState()

      connection.close()
      const state2 = connection.getState()

      expect(state1).toBe('closed')
      expect(state2).toBe('closed')
    })
  })

  describe('logging', () => {
    it('should call onLog callback when provided', () => {
      const onLog = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, 'id', {
        onLog,
      })

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[Connection]'),
          level: 'debug',
        })
      )
    })
  })
})
