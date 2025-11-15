import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PortRegistry } from '../../src/port/registry'

// Mock MessagePort
class MockMessagePort {
  postMessage() {
    // No-op for mock
  }

  start() {
    // No-op for mock
  }
}

interface TestMetadata {
  visible: boolean
  lastSeen: number
}

describe('PortRegistry', () => {
  let registry: PortRegistry<MessagePort, TestMetadata>
  let mockPort1: MessagePort
  let mockPort2: MessagePort

  beforeEach(() => {
    registry = new PortRegistry()
    mockPort1 = new MockMessagePort() as unknown as MessagePort
    mockPort2 = new MockMessagePort() as unknown as MessagePort
  })

  describe('register', () => {
    it('should register a new port', () => {
      registry.register('port1', mockPort1)
      expect(registry.has('port1')).toBe(true)
      expect(registry.get('port1')).toBe(mockPort1)
    })

    it('should register a port with metadata', () => {
      const meta: TestMetadata = { visible: true, lastSeen: Date.now() }
      registry.register('port1', mockPort1, meta)

      const entry = registry.getEntry('port1')
      expect(entry?.meta).toEqual(meta)
    })

    it('should emit add event when registering', () => {
      const addListener = vi.fn()
      registry.on('add', addListener)

      registry.register('port1', mockPort1)

      expect(addListener).toHaveBeenCalledWith({
        id: 'port1',
        port: mockPort1,
        meta: undefined,
      })
    })
  })

  describe('get', () => {
    it('should return port by ID', () => {
      registry.register('port1', mockPort1)
      expect(registry.get('port1')).toBe(mockPort1)
    })

    it('should return undefined for non-existent port', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('getEntry', () => {
    it('should return full entry with metadata', () => {
      const meta: TestMetadata = { visible: true, lastSeen: 123 }
      registry.register('port1', mockPort1, meta)

      const entry = registry.getEntry('port1')
      expect(entry).toEqual({
        id: 'port1',
        port: mockPort1,
        meta,
      })
    })

    it('should return undefined for non-existent entry', () => {
      expect(registry.getEntry('nonexistent')).toBeUndefined()
    })
  })

  describe('updateMeta', () => {
    it('should update metadata for existing port', () => {
      const meta1: TestMetadata = { visible: true, lastSeen: 100 }
      const meta2: TestMetadata = { visible: false, lastSeen: 200 }

      registry.register('port1', mockPort1, meta1)
      expect(registry.updateMeta('port1', meta2)).toBe(true)

      const entry = registry.getEntry('port1')
      expect(entry?.meta).toEqual(meta2)
    })

    it('should return false for non-existent port', () => {
      const meta: TestMetadata = { visible: true, lastSeen: 100 }
      expect(registry.updateMeta('nonexistent', meta)).toBe(false)
    })
  })

  describe('remove', () => {
    it('should remove port from registry', () => {
      registry.register('port1', mockPort1)
      expect(registry.has('port1')).toBe(true)

      const removed = registry.remove('port1')
      expect(removed).toBe(true)
      expect(registry.has('port1')).toBe(false)
    })

    it('should return false when removing non-existent port', () => {
      expect(registry.remove('nonexistent')).toBe(false)
    })

    it('should emit remove event when removing', () => {
      const removeListener = vi.fn()
      registry.on('remove', removeListener)

      registry.register('port1', mockPort1)
      registry.remove('port1')

      expect(removeListener).toHaveBeenCalledWith({
        id: 'port1',
        port: mockPort1,
        meta: undefined,
      })
    })
  })

  describe('list', () => {
    it('should return all registered ports', () => {
      registry.register('port1', mockPort1)
      registry.register('port2', mockPort2)

      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list.map((entry) => entry.id)).toContain('port1')
      expect(list.map((entry) => entry.id)).toContain('port2')
    })

    it('should return empty array when no ports registered', () => {
      expect(registry.list()).toEqual([])
    })
  })

  describe('size', () => {
    it('should return number of registered ports', () => {
      expect(registry.size()).toBe(0)

      registry.register('port1', mockPort1)
      expect(registry.size()).toBe(1)

      registry.register('port2', mockPort2)
      expect(registry.size()).toBe(2)

      registry.remove('port1')
      expect(registry.size()).toBe(1)
    })
  })

  describe('has', () => {
    it('should check if port is registered', () => {
      expect(registry.has('port1')).toBe(false)

      registry.register('port1', mockPort1)
      expect(registry.has('port1')).toBe(true)

      registry.remove('port1')
      expect(registry.has('port1')).toBe(false)
    })
  })

  describe('event listeners', () => {
    it('should support multiple listeners for same event', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      registry.on('add', listener1)
      registry.on('add', listener2)

      registry.register('port1', mockPort1)

      expect(listener1).toHaveBeenCalledOnce()
      expect(listener2).toHaveBeenCalledOnce()
    })

    it('should allow removing listeners', () => {
      const listener = vi.fn()

      registry.on('add', listener)
      registry.register('port1', mockPort1)
      expect(listener).toHaveBeenCalledOnce()

      listener.mockClear()
      registry.off('add', listener)
      registry.register('port2', mockPort2)
      expect(listener).not.toHaveBeenCalled()
    })

    it('should support both add and remove events', () => {
      const addListener = vi.fn()
      const removeListener = vi.fn()

      registry.on('add', addListener)
      registry.on('remove', removeListener)

      registry.register('port1', mockPort1)
      expect(addListener).toHaveBeenCalledOnce()
      expect(removeListener).not.toHaveBeenCalled()

      addListener.mockClear()
      registry.remove('port1')
      expect(removeListener).toHaveBeenCalledOnce()
      expect(addListener).not.toHaveBeenCalled()
    })
  })

  describe('shutdown', () => {
    it('should emit remove events for all entries', async () => {
      const removeListener = vi.fn()
      registry.on('remove', removeListener)

      registry.register('port1', mockPort1)
      registry.register('port2', mockPort2)

      await registry.shutdown()

      expect(removeListener).toHaveBeenCalledTimes(2)
      expect(registry.size()).toBe(0)
    })

    it('should clear all listeners', async () => {
      const addListener = vi.fn()
      const removeListener = vi.fn()

      registry.on('add', addListener)
      registry.on('remove', removeListener)

      registry.register('port1', mockPort1)
      await registry.shutdown()

      addListener.mockClear()
      removeListener.mockClear()

      // After shutdown, listeners should not be called
      registry.register('port2', mockPort2)
      expect(addListener).not.toHaveBeenCalled()
    })
  })
})
