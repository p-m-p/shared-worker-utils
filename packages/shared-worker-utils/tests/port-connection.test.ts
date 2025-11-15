import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection } from '../src/port/connection'

// Mock MessagePort for testing
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

  // Test helper to check if listeners are removed
  hasListeners(type: string): boolean {
    const listeners = this.listeners.get(type)
    return listeners !== undefined && listeners.length > 0
  }
}

describe('Connection', () => {
  let mockPort: MockMessagePort
  let connection: Connection<MessagePort>

  beforeEach(() => {
    mockPort = new MockMessagePort() as unknown as MessagePort
  })

  describe('constructor', () => {
    it('should create a connection with default options', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.getPort()).toBe(mockPort)
      expect(connection.isVisible()).toBe(true)
      expect(connection.getLastPong()).toBeGreaterThan(0)
    })

    it('should create a connection with custom visibility', () => {
      connection = new Connection(mockPort as unknown as MessagePort, {
        visible: false,
      })

      expect(connection.isVisible()).toBe(false)
    })

    it('should create a connection with custom lastPong', () => {
      const customTime = 12_345
      connection = new Connection(mockPort as unknown as MessagePort, {
        lastPong: customTime,
      })

      expect(connection.getLastPong()).toBe(customTime)
    })

    it('should set up message handler when provided', () => {
      const onMessage = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, {
        onMessage,
      })

      mockPort.simulateMessage({ test: 'data' })

      expect(onMessage).toHaveBeenCalledWith(mockPort, { test: 'data' })
    })
  })

  describe('getPort', () => {
    it('should return the port instance', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.getPort()).toBe(mockPort)
    })
  })

  describe('getState', () => {
    it('should return the current state', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      const state = connection.getState()

      expect(state).toHaveProperty('visible')
      expect(state).toHaveProperty('lastPong')
      expect(state).toHaveProperty('controller')
      expect(state.controller).toBeInstanceOf(AbortController)
    })
  })

  describe('setVisible and isVisible', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort, {
        visible: true,
      })
    })

    it('should update visibility to false', () => {
      connection.setVisible(false)

      expect(connection.isVisible()).toBe(false)
    })

    it('should update visibility to true', () => {
      connection.setVisible(false)
      connection.setVisible(true)

      expect(connection.isVisible()).toBe(true)
    })
  })

  describe('updateLastPong and getLastPong', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort, {
        lastPong: 1000,
      })
    })

    it('should update lastPong timestamp', () => {
      const beforeUpdate = connection.getLastPong()

      // Wait a bit to ensure time passes
      vi.useFakeTimers()
      vi.advanceTimersByTime(100)

      connection.updateLastPong()
      const afterUpdate = connection.getLastPong()

      expect(afterUpdate).toBeGreaterThan(beforeUpdate)

      vi.useRealTimers()
    })
  })

  describe('isStale', () => {
    it('should return false for a fresh connection', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      expect(connection.isStale(5000)).toBe(false)
    })

    it('should return true for a stale connection', () => {
      vi.useFakeTimers()
      const pastTime = Date.now() - 10_000
      connection = new Connection(mockPort as unknown as MessagePort, {
        lastPong: pastTime,
      })

      expect(connection.isStale(5000)).toBe(true)

      vi.useRealTimers()
    })

    it('should return false when exactly at threshold', () => {
      const threshold = 5000
      const pastTime = Date.now() - threshold
      connection = new Connection(mockPort as unknown as MessagePort, {
        lastPong: pastTime,
      })

      expect(connection.isStale(threshold)).toBe(false)
    })
  })

  describe('start', () => {
    it('should call start on MessagePort', () => {
      const startSpy = vi.spyOn(mockPort, 'start')
      connection = new Connection(mockPort as unknown as MessagePort)

      connection.start()

      expect(startSpy).toHaveBeenCalled()
    })
  })

  describe('postMessage', () => {
    beforeEach(() => {
      connection = new Connection(mockPort as unknown as MessagePort)
    })

    it('should post a message to the port', () => {
      const message = { type: 'test', data: 'hello' }

      connection.postMessage(message)

      expect(mockPort.lastMessage).toEqual(message)
    })
  })

  describe('abort', () => {
    it('should abort the connection controller', () => {
      connection = new Connection(mockPort as unknown as MessagePort)
      const controller = connection.getController()

      expect(controller.signal.aborted).toBe(false)

      connection.abort()

      expect(controller.signal.aborted).toBe(true)
    })

    it('should remove message listeners when aborted', () => {
      const onMessage = vi.fn()
      connection = new Connection(mockPort as unknown as MessagePort, {
        onMessage,
      })

      // Verify listener is active
      mockPort.simulateMessage({ test: 'data' })
      expect(onMessage).toHaveBeenCalledTimes(1)

      connection.abort()

      // Verify listener is removed after abort
      mockPort.simulateMessage({ test: 'data2' })
      expect(onMessage).toHaveBeenCalledTimes(1) // Should still be 1
    })
  })

  describe('getController', () => {
    it('should return the AbortController', () => {
      connection = new Connection(mockPort as unknown as MessagePort)

      const controller = connection.getController()

      expect(controller).toBeInstanceOf(AbortController)
      expect(controller.signal).toBeDefined()
    })
  })
})
