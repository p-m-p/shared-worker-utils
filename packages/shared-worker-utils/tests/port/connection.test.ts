import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection } from '../../src/port/connection'
import { MESSAGE_TYPES } from '../../src/port/utilities'

// Mock MessagePort
class MockMessagePort {
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>()
  lastMessage?: unknown

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: { signal?: AbortSignal }
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)?.push(listener)

    // Listen for abort signal
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        const listeners = this.listeners.get(type)
        if (listeners) {
          const index = listeners.indexOf(listener)
          if (index !== -1) {
            listeners.splice(index, 1)
          }
        }
      })
    }
  }

  postMessage(data: unknown) {
    this.lastMessage = data
  }

  start() {
    // No-op for mock
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const listeners = this.listeners.get('message')
    if (listeners) {
      for (const listener of listeners) {
        listener({ data } as MessageEvent)
      }
    }
  }

  hasListeners(): boolean {
    for (const listeners of this.listeners.values()) {
      if (listeners.length > 0) return true
    }
    return false
  }
}

describe('Connection', () => {
  let mockPort: MockMessagePort
  let connection: Connection

  beforeEach(() => {
    mockPort = new MockMessagePort()
  })

  describe('constructor', () => {
    it('should create connection with auto-generated id', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      const id = connection.getId()
      expect(id).toMatch(/^port-\d+-[a-z0-9]+$/)
    })

    it('should create connection with custom id', () => {
      connection = new Connection(
        mockPort as unknown as MessagePort,
        'custom-id'
      )

      expect(connection.getId()).toBe('custom-id')
    })

    it('should start port by default', () => {
      const startSpy = vi.spyOn(mockPort, 'start')
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(startSpy).toHaveBeenCalled()
      expect(connection.getState()).toBe('connected')
    })

    it('should not start port if autoStart is false', () => {
      const startSpy = vi.spyOn(mockPort, 'start')
      connection = new Connection(
        mockPort as unknown as MessagePort,
        undefined,
        {
          autoStart: false,
        }
      )

      expect(startSpy).not.toHaveBeenCalled()
      expect(connection.getState()).toBe('connecting')
    })
  })

  describe('send', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should send messages through the port', () => {
      const message = { type: 'test', data: 'hello' }
      connection.send(message)

      expect(mockPort.lastMessage).toEqual(message)
    })

    it('should not send if connection is disconnected', () => {
      connection.close()
      mockPort.lastMessage = undefined

      connection.send({ type: 'test' })

      expect(mockPort.lastMessage).toBeUndefined()
    })

    it('should handle errors when sending messages', () => {
      const postMessageSpy = vi
        .spyOn(mockPort, 'postMessage')
        .mockImplementation(() => {
          throw new Error('Send failed')
        })

      // Should not throw
      expect(() => connection.send({ type: 'test' })).not.toThrow()

      postMessageSpy.mockRestore()
    })
  })

  describe('sendInternal', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should send ping message', () => {
      connection.sendInternal('PING')

      expect(mockPort.lastMessage).toEqual({
        type: MESSAGE_TYPES.PING,
      })
    })

    it('should send pong message', () => {
      connection.sendInternal('PONG')

      expect(mockPort.lastMessage).toEqual({
        type: MESSAGE_TYPES.PONG,
      })
    })

    it('should send internal message with additional data', () => {
      connection.sendInternal('VISIBILITY_CHANGE', { visible: false })

      expect(mockPort.lastMessage).toEqual({
        type: MESSAGE_TYPES.VISIBILITY_CHANGE,
        visible: false,
      })
    })
  })

  describe('onMessage', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should receive messages', () => {
      const onMessage = vi.fn()
      connection.onMessage(onMessage)

      const message = { type: 'test', data: 'hello' }
      mockPort.simulateMessage(message)

      expect(onMessage).toHaveBeenCalledWith(
        message,
        expect.objectContaining({ data: message })
      )
    })

    it('should support multiple message callbacks', () => {
      const onMessage1 = vi.fn()
      const onMessage2 = vi.fn()

      connection.onMessage(onMessage1)
      connection.onMessage(onMessage2)

      const message = { type: 'test' }
      mockPort.simulateMessage(message)

      expect(onMessage1).toHaveBeenCalled()
      expect(onMessage2).toHaveBeenCalled()
    })

    it('should not call removed callbacks', () => {
      const onMessage = vi.fn()
      connection.onMessage(onMessage)
      connection.offMessage(onMessage)

      mockPort.simulateMessage({ type: 'test' })

      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('onClose', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should call close callbacks when connection is closed', () => {
      const onClose = vi.fn()
      connection.onClose(onClose)

      connection.close()

      expect(onClose).toHaveBeenCalled()
    })

    it('should support multiple close callbacks', () => {
      const onClose1 = vi.fn()
      const onClose2 = vi.fn()

      connection.onClose(onClose1)
      connection.onClose(onClose2)

      connection.close()

      expect(onClose1).toHaveBeenCalled()
      expect(onClose2).toHaveBeenCalled()
    })

    it('should not call removed close callbacks', () => {
      const onClose = vi.fn()
      connection.onClose(onClose)
      connection.offClose(onClose)

      connection.close()

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should change state to disconnected', () => {
      connection.close()

      expect(connection.getState()).toBe('disconnected')
    })

    it('should clean up message listeners', () => {
      const onMessage = vi.fn()
      connection.onMessage(onMessage)

      connection.close()

      mockPort.simulateMessage({ type: 'test' })

      // Message callback should not be called after close
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('should abort controller to remove event listeners', () => {
      expect(mockPort.hasListeners()).toBe(true)

      connection.close()

      expect(mockPort.hasListeners()).toBe(false)
    })

    it('should be idempotent', () => {
      const onClose = vi.fn()
      connection.onClose(onClose)

      connection.close()
      connection.close()

      // Should only be called once
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should clear all callbacks', () => {
      const onMessage = vi.fn()
      const onClose = vi.fn()

      connection.onMessage(onMessage)
      connection.onClose(onClose)

      connection.close()

      // Try to trigger callbacks after close
      mockPort.simulateMessage({ type: 'test' })

      // Message should not be called (already tested above)
      // Close should have been called once during close
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPort', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should return the underlying port', () => {
      expect(connection.getPort()).toBe(mockPort)
    })
  })

  describe('logging', () => {
    it('should call onLog callback when provided', () => {
      const onLog = vi.fn()
      connection = new Connection(
        mockPort as unknown as MessagePort,
        'test-id',
        {
          onLog,
        }
      )

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Connection established'),
          level: 'info',
        })
      )
    })

    it('should include connection id in log prefix', () => {
      const onLog = vi.fn()
      connection = new Connection(
        mockPort as unknown as MessagePort,
        'test-id',
        {
          onLog,
        }
      )

      mockPort.simulateMessage({ type: 'test' })

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[Connection:test-id]'),
        })
      )
    })
  })
})
