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

describe('PortRegistry', () => {
  let registry: PortRegistry<MessagePort>

  beforeEach(() => {
    registry = new PortRegistry()
  })

  describe('register', () => {
    it('should register a new port', () => {
      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(registry.get('port-1')).toBe(port)
      expect(registry.size()).toBe(1)
    })

    it('should register a port with metadata', () => {
      const port = new MockMessagePort() as unknown as MessagePort
      const meta = { visible: true, lastPong: Date.now() }
      registry.register('port-1', port, meta)

      const entry = registry.getEntry('port-1')
      expect(entry?.port).toBe(port)
      expect(entry?.meta).toEqual(meta)
    })

    it('should emit add event when port is registered', () => {
      const onAdd = vi.fn()
      registry.on('add', onAdd)

      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(onAdd).toHaveBeenCalledWith({
        id: 'port-1',
        port,
        meta: undefined,
      })
    })

    it('should override existing port with same id', () => {
      const port1 = new MockMessagePort() as unknown as MessagePort
      const port2 = new MockMessagePort() as unknown as MessagePort

      registry.register('port-1', port1)
      registry.register('port-1', port2)

      expect(registry.get('port-1')).toBe(port2)
      expect(registry.size()).toBe(1)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent port', () => {
      expect(registry.get('non-existent')).toBeUndefined()
    })

    it('should return the registered port', () => {
      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(registry.get('port-1')).toBe(port)
    })
  })

  describe('getEntry', () => {
    it('should return undefined for non-existent port', () => {
      expect(registry.getEntry('non-existent')).toBeUndefined()
    })

    it('should return the full entry with metadata', () => {
      const port = new MockMessagePort() as unknown as MessagePort
      const meta = { test: 'data' }
      registry.register('port-1', port, meta)

      const entry = registry.getEntry('port-1')
      expect(entry).toEqual({
        id: 'port-1',
        port,
        meta,
      })
    })
  })

  describe('remove', () => {
    it('should return false for non-existent port', () => {
      expect(registry.remove('non-existent')).toBe(false)
    })

    it('should remove an existing port', () => {
      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(registry.remove('port-1')).toBe(true)
      expect(registry.get('port-1')).toBeUndefined()
      expect(registry.size()).toBe(0)
    })

    it('should emit remove event when port is removed', () => {
      const onRemove = vi.fn()
      registry.on('remove', onRemove)

      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)
      registry.remove('port-1')

      expect(onRemove).toHaveBeenCalledWith({
        id: 'port-1',
        port,
        meta: undefined,
      })
    })
  })

  describe('list', () => {
    it('should return empty array for no ports', () => {
      expect(registry.list()).toEqual([])
    })

    it('should return all registered ports', () => {
      const port1 = new MockMessagePort() as unknown as MessagePort
      const port2 = new MockMessagePort() as unknown as MessagePort

      registry.register('port-1', port1, { index: 1 })
      registry.register('port-2', port2, { index: 2 })

      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list).toEqual([
        { id: 'port-1', port: port1, meta: { index: 1 } },
        { id: 'port-2', port: port2, meta: { index: 2 } },
      ])
    })
  })

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0)
    })

    it('should return correct count of registered ports', () => {
      const port1 = new MockMessagePort() as unknown as MessagePort
      const port2 = new MockMessagePort() as unknown as MessagePort

      registry.register('port-1', port1)
      expect(registry.size()).toBe(1)

      registry.register('port-2', port2)
      expect(registry.size()).toBe(2)

      registry.remove('port-1')
      expect(registry.size()).toBe(1)
    })
  })

  describe('event listeners', () => {
    it('should support multiple listeners for same event', () => {
      const onAdd1 = vi.fn()
      const onAdd2 = vi.fn()

      registry.on('add', onAdd1)
      registry.on('add', onAdd2)

      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(onAdd1).toHaveBeenCalled()
      expect(onAdd2).toHaveBeenCalled()
    })

    it('should remove listener with off', () => {
      const onAdd = vi.fn()
      registry.on('add', onAdd)
      registry.off('add', onAdd)

      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)

      expect(onAdd).not.toHaveBeenCalled()
    })

    it('should support both add and remove events', () => {
      const onAdd = vi.fn()
      const onRemove = vi.fn()

      registry.on('add', onAdd)
      registry.on('remove', onRemove)

      const port = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port)
      registry.remove('port-1')

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  describe('shutdown', () => {
    it('should clear all ports', async () => {
      const port1 = new MockMessagePort() as unknown as MessagePort
      const port2 = new MockMessagePort() as unknown as MessagePort

      registry.register('port-1', port1)
      registry.register('port-2', port2)

      await registry.shutdown()

      expect(registry.size()).toBe(0)
      expect(registry.list()).toEqual([])
    })

    it('should emit remove events for all ports on shutdown', async () => {
      const onRemove = vi.fn()
      registry.on('remove', onRemove)

      const port1 = new MockMessagePort() as unknown as MessagePort
      const port2 = new MockMessagePort() as unknown as MessagePort

      registry.register('port-1', port1)
      registry.register('port-2', port2)

      await registry.shutdown()

      expect(onRemove).toHaveBeenCalledTimes(2)
    })

    it('should clear all listeners on shutdown', async () => {
      const onAdd = vi.fn()
      registry.on('add', onAdd)

      const port1 = new MockMessagePort() as unknown as MessagePort
      registry.register('port-1', port1)

      await registry.shutdown()

      // After shutdown, listeners should be cleared
      const port2 = new MockMessagePort() as unknown as MessagePort
      registry.register('port-2', port2)

      // onAdd should only be called once (before shutdown)
      expect(onAdd).toHaveBeenCalledTimes(1)
    })
  })

  describe('logging', () => {
    it('should call onLog callback when provided', () => {
      const onLog = vi.fn()
      const registryWithLog = new PortRegistry({ onLog })

      const port = new MockMessagePort() as unknown as MessagePort
      registryWithLog.register('port-1', port)

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Port registered'),
          level: 'debug',
        })
      )
    })
  })
})
