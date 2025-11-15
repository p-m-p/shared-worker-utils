import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PortRegistry } from '../../src/port/registry'

// Mock MessagePort
class MockMessagePort {
  postMessage(_data: unknown) {
    // No-op for mock
  }
}

describe('PortRegistry', () => {
  let registry: PortRegistry<MockMessagePort>

  beforeEach(() => {
    registry = new PortRegistry<MockMessagePort>()
  })

  describe('register', () => {
    it('should register a port', () => {
      const port = new MockMessagePort()
      const portId = 'test-port-1'

      registry.register(portId, port)

      expect(registry.get(portId)).toBe(port)
      expect(registry.size()).toBe(1)
    })

    it('should register a port with metadata', () => {
      const port = new MockMessagePort()
      const portId = 'test-port-1'
      const meta = {
        visible: true,
        lastPong: Date.now(),
        controller: new AbortController(),
      }

      registry.register(portId, port, meta)

      const entry = registry.getEntry(portId)
      expect(entry?.port).toBe(port)
      expect(entry?.meta).toBe(meta)
    })

    it('should emit add event when registering a port', () => {
      const port = new MockMessagePort()
      const portId = 'test-port-1'
      const addCallback = vi.fn()

      registry.on('add', addCallback)
      registry.register(portId, port)

      expect(addCallback).toHaveBeenCalledTimes(1)
      expect(addCallback).toHaveBeenCalledWith({
        id: portId,
        port,
        meta: undefined,
      })
    })

    it('should allow registering multiple ports', () => {
      const port1 = new MockMessagePort()
      const port2 = new MockMessagePort()

      registry.register('port-1', port1)
      registry.register('port-2', port2)

      expect(registry.size()).toBe(2)
      expect(registry.get('port-1')).toBe(port1)
      expect(registry.get('port-2')).toBe(port2)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent port', () => {
      expect(registry.get('non-existent')).toBeUndefined()
    })

    it('should return the registered port', () => {
      const port = new MockMessagePort()
      registry.register('test-port', port)

      expect(registry.get('test-port')).toBe(port)
    })
  })

  describe('getEntry', () => {
    it('should return undefined for non-existent port', () => {
      expect(registry.getEntry('non-existent')).toBeUndefined()
    })

    it('should return the full port entry', () => {
      const port = new MockMessagePort()
      const meta = {
        visible: true,
        lastPong: Date.now(),
        controller: new AbortController(),
      }

      registry.register('test-port', port, meta)

      const entry = registry.getEntry('test-port')
      expect(entry).toEqual({
        id: 'test-port',
        port,
        meta,
      })
    })
  })

  describe('remove', () => {
    it('should return false for non-existent port', () => {
      expect(registry.remove('non-existent')).toBe(false)
    })

    it('should remove a registered port', () => {
      const port = new MockMessagePort()
      registry.register('test-port', port)

      expect(registry.size()).toBe(1)
      expect(registry.remove('test-port')).toBe(true)
      expect(registry.size()).toBe(0)
      expect(registry.get('test-port')).toBeUndefined()
    })

    it('should abort controller when removing port with metadata', () => {
      const port = new MockMessagePort()
      const controller = new AbortController()
      const abortSpy = vi.spyOn(controller, 'abort')

      registry.register('test-port', port, {
        visible: true,
        lastPong: Date.now(),
        controller,
      })

      registry.remove('test-port')

      expect(abortSpy).toHaveBeenCalled()
    })

    it('should emit remove event when removing a port', () => {
      const port = new MockMessagePort()
      const portId = 'test-port-1'
      const removeCallback = vi.fn()

      registry.register(portId, port)
      registry.on('remove', removeCallback)
      registry.remove(portId)

      expect(removeCallback).toHaveBeenCalledTimes(1)
      expect(removeCallback).toHaveBeenCalledWith({
        id: portId,
        port,
        meta: undefined,
      })
    })
  })

  describe('list', () => {
    it('should return empty array when no ports registered', () => {
      expect(registry.list()).toEqual([])
    })

    it('should return all registered ports', () => {
      const port1 = new MockMessagePort()
      const port2 = new MockMessagePort()

      registry.register('port-1', port1)
      registry.register('port-2', port2)

      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list).toEqual([
        { id: 'port-1', port: port1, meta: undefined },
        { id: 'port-2', port: port2, meta: undefined },
      ])
    })
  })

  describe('size', () => {
    it('should return 0 when no ports registered', () => {
      expect(registry.size()).toBe(0)
    })

    it('should return the number of registered ports', () => {
      registry.register('port-1', new MockMessagePort())
      expect(registry.size()).toBe(1)

      registry.register('port-2', new MockMessagePort())
      expect(registry.size()).toBe(2)

      registry.remove('port-1')
      expect(registry.size()).toBe(1)
    })
  })

  describe('on', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = registry.on('add', callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn()
      const unsubscribe = registry.on('add', callback)

      registry.register('port-1', new MockMessagePort())
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()
      registry.register('port-2', new MockMessagePort())
      expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
    })

    it('should support multiple listeners for same event', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      registry.on('add', callback1)
      registry.on('add', callback2)

      registry.register('port-1', new MockMessagePort())

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })
  })

  describe('shutdown', () => {
    it('should remove all ports', async () => {
      registry.register('port-1', new MockMessagePort())
      registry.register('port-2', new MockMessagePort())

      expect(registry.size()).toBe(2)

      await registry.shutdown()

      expect(registry.size()).toBe(0)
    })

    it('should abort all controllers', async () => {
      const controller1 = new AbortController()
      const controller2 = new AbortController()
      const abort1Spy = vi.spyOn(controller1, 'abort')
      const abort2Spy = vi.spyOn(controller2, 'abort')

      registry.register('port-1', new MockMessagePort(), {
        visible: true,
        lastPong: Date.now(),
        controller: controller1,
      })
      registry.register('port-2', new MockMessagePort(), {
        visible: true,
        lastPong: Date.now(),
        controller: controller2,
      })

      await registry.shutdown()

      expect(abort1Spy).toHaveBeenCalled()
      expect(abort2Spy).toHaveBeenCalled()
    })

    it('should clear all event listeners', async () => {
      const callback = vi.fn()
      registry.on('add', callback)

      await registry.shutdown()

      // Try to register after shutdown
      registry.register('port-1', new MockMessagePort())

      // Callback should not be called since listeners were cleared
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('logging', () => {
    it('should call onLog callback when provided', () => {
      const onLog = vi.fn()
      const registryWithLog = new PortRegistry({ onLog })

      registryWithLog.register('test-port', new MockMessagePort())

      expect(onLog).toHaveBeenCalled()
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('[PortRegistry]'),
          level: 'debug',
        })
      )
    })
  })
})
