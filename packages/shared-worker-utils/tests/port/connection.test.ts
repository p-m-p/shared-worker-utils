import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection } from '../../src/port/connection'
import { ConnectionState } from '../../src/types'

// Mock MessagePort
class MockMessagePort {
  private listeners = new Map<string, (event: MessageEvent) => void>()

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: { signal?: AbortSignal }
  ) {
    this.listeners.set(type, listener)
    // Handle abort signal cleanup
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        this.listeners.delete(type)
      })
    }
  }

  postMessage() {
    // No-op for mock
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

  hasListeners(): boolean {
    return this.listeners.size > 0
  }
}

describe('Connection', () => {
  let mockPort: MockMessagePort
  let connection: Connection

  beforeEach(() => {
    mockPort = new MockMessagePort()
  })

  describe('constructor', () => {
    it('should create connection with generated ID', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        undefined,
        { autoStart: false }
      )
      expect(connection.getId()).toMatch(/^conn_/)
      expect(connection.getState()).toBe(ConnectionState.CONNECTING)
    })

    it('should create connection with custom ID', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        'custom-id',
        { autoStart: false }
      )
      expect(connection.getId()).toBe('custom-id')
    })

    it('should auto-start by default', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      expect(connection.getState()).toBe(ConnectionState.CONNECTED)
    })

    it('should not auto-start when disabled', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        undefined,
        { autoStart: false }
      )
      expect(connection.getState()).toBe(ConnectionState.CONNECTING)
    })
  })

  describe('start', () => {
    it('should start connection', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        undefined,
        { autoStart: false }
      )
      expect(connection.getState()).toBe(ConnectionState.CONNECTING)

      connection.start()
      expect(connection.getState()).toBe(ConnectionState.CONNECTED)
    })

    it('should not restart already connected connection', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      expect(connection.getState()).toBe(ConnectionState.CONNECTED)

      connection.start()
      expect(connection.getState()).toBe(ConnectionState.CONNECTED)
    })
  })

  describe('send', () => {
    it('should send message through port', () => {
      const postMessageSpy = vi.spyOn(mockPort, 'postMessage')
      connection = new Connection(mockPort as unknown as MessagePort)

      const testMessage = { type: 'test', data: 'hello' }
      connection.send(testMessage)

      expect(postMessageSpy).toHaveBeenCalledWith(testMessage)
    })

    it('should not send message on closed connection', () => {
      const onLog = vi.fn()
      const postMessageSpy = vi.spyOn(mockPort, 'postMessage')
      connection = new Connection(
        mockPort as unknown as MessagePort,
        undefined,
        { onLog }
      )

      connection.close()
      connection.send({ type: 'test' })

      expect(postMessageSpy).not.toHaveBeenCalled()
      expect(onLog).toHaveBeenCalledWith({
        message: expect.stringContaining('Cannot send message on closed'),
        level: 'warn',
        context: undefined,
      })
    })
  })

  describe('message handling', () => {
    it('should call message listeners when message received', () => {
      const messageListener = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onMessage(messageListener)

      const testMessage = { type: 'test', data: 'hello' }
      mockPort.simulateMessage(testMessage)

      expect(messageListener).toHaveBeenCalledWith(
        testMessage,
        expect.anything()
      )
    })

    it('should support multiple message listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onMessage(listener1)
      connection.onMessage(listener2)

      const testMessage = { type: 'test' }
      mockPort.simulateMessage(testMessage)

      expect(listener1).toHaveBeenCalledWith(testMessage, expect.anything())
      expect(listener2).toHaveBeenCalledWith(testMessage, expect.anything())
    })

    it('should allow removing message listeners', () => {
      const listener = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onMessage(listener)

      mockPort.simulateMessage({ type: 'test1' })
      expect(listener).toHaveBeenCalledOnce()

      listener.mockClear()
      connection.offMessage(listener)

      mockPort.simulateMessage({ type: 'test2' })
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('should close connection', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      expect(connection.getState()).toBe(ConnectionState.CONNECTED)

      connection.close()
      expect(connection.getState()).toBe(ConnectionState.CLOSED)
    })

    it('should call close listeners', () => {
      const closeListener = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onClose(closeListener)

      connection.close()
      expect(closeListener).toHaveBeenCalledOnce()
    })

    it('should support multiple close listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onClose(listener1)
      connection.onClose(listener2)

      connection.close()
      expect(listener1).toHaveBeenCalledOnce()
      expect(listener2).toHaveBeenCalledOnce()
    })

    it('should clear message listeners on close', () => {
      const messageListener = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onMessage(messageListener)

      connection.close()

      mockPort.simulateMessage({ type: 'test' })
      expect(messageListener).not.toHaveBeenCalled()
    })

    it('should clear close listeners after close', () => {
      const closeListener = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onClose(closeListener)

      connection.close()
      expect(closeListener).toHaveBeenCalledOnce()

      closeListener.mockClear()
      connection.close() // Try closing again
      expect(closeListener).not.toHaveBeenCalled()
    })

    it('should be idempotent', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      connection.close()
      expect(connection.getState()).toBe(ConnectionState.CLOSED)

      connection.close() // Should not throw
      expect(connection.getState()).toBe(ConnectionState.CLOSED)
    })

    it('should clean up port event listeners via abort controller', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      expect(mockPort.hasListeners()).toBe(true)

      connection.close()
      expect(mockPort.hasListeners()).toBe(false)
    })
  })

  describe('close listener management', () => {
    it('should allow removing close listeners', () => {
      const listener = vi.fn()

      connection = new Connection(mockPort as unknown as MessagePort)
      connection.onClose(listener)
      connection.offClose(listener)

      connection.close()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('getPort', () => {
    it('should return the underlying port', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      expect(connection.getPort()).toBe(mockPort)
    })
  })

  describe('logging', () => {
    it('should log connection lifecycle events', () => {
      const onLog = vi.fn()

      connection = new Connection(
        mockPort as unknown as MessagePort,
        'test-conn',
        { onLog }
      )

      expect(onLog).toHaveBeenCalledWith({
        message: '[Connection] Connection test-conn started',
        level: 'debug',
        context: undefined,
      })

      onLog.mockClear()
      connection.close()

      expect(onLog).toHaveBeenCalledWith({
        message: '[Connection] Connection test-conn closed',
        level: 'debug',
        context: undefined,
      })
    })
  })
})
