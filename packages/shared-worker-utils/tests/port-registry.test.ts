import { describe, it, expect, beforeEach } from 'vitest'
import { PortRegistry } from '../src/port/registry'
import type { ClientState } from '../src/types'

// Mock MessagePort
class MockMessagePort {
  id: string
  constructor(id: string) {
    this.id = id
  }
}

describe('PortRegistry', () => {
  let registry: PortRegistry<MockMessagePort>
  let port1: MockMessagePort
  let port2: MockMessagePort
  let state1: ClientState
  let state2: ClientState

  beforeEach(() => {
    registry = new PortRegistry()
    port1 = new MockMessagePort('port1')
    port2 = new MockMessagePort('port2')
    state1 = {
      visible: true,
      lastPong: Date.now(),
      controller: new AbortController(),
    }
    state2 = {
      visible: false,
      lastPong: Date.now(),
      controller: new AbortController(),
    }
  })

  describe('register', () => {
    it('should register a new port', () => {
      registry.register(port1, state1)
      expect(registry.has(port1)).toBe(true)
      expect(registry.getTotal()).toBe(1)
    })

    it('should allow registering multiple ports', () => {
      registry.register(port1, state1)
      registry.register(port2, state2)
      expect(registry.getTotal()).toBe(2)
    })
  })

  describe('get', () => {
    it('should return the client state for a registered port', () => {
      registry.register(port1, state1)
      const retrieved = registry.get(port1)
      expect(retrieved).toEqual(state1)
    })

    it('should return undefined for an unregistered port', () => {
      expect(registry.get(port1)).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update the client state for a registered port', () => {
      registry.register(port1, state1)
      registry.update(port1, { visible: false })
      const updated = registry.get(port1)
      expect(updated?.visible).toBe(false)
      expect(updated?.lastPong).toBe(state1.lastPong)
    })

    it('should do nothing for an unregistered port', () => {
      registry.update(port1, { visible: false })
      expect(registry.has(port1)).toBe(false)
    })
  })

  describe('remove', () => {
    it('should remove a registered port', () => {
      registry.register(port1, state1)
      const removed = registry.remove(port1)
      expect(removed).toBe(true)
      expect(registry.has(port1)).toBe(false)
      expect(registry.getTotal()).toBe(0)
    })

    it('should return false when removing an unregistered port', () => {
      const removed = registry.remove(port1)
      expect(removed).toBe(false)
    })
  })

  describe('has', () => {
    it('should return true for registered ports', () => {
      registry.register(port1, state1)
      expect(registry.has(port1)).toBe(true)
    })

    it('should return false for unregistered ports', () => {
      expect(registry.has(port1)).toBe(false)
    })
  })

  describe('getPorts', () => {
    it('should return an empty array when no ports are registered', () => {
      expect(registry.getPorts()).toEqual([])
    })

    it('should return all registered ports', () => {
      registry.register(port1, state1)
      registry.register(port2, state2)
      const ports = registry.getPorts()
      expect(ports).toHaveLength(2)
      expect(ports).toContain(port1)
      expect(ports).toContain(port2)
    })
  })

  describe('getEntries', () => {
    it('should return an empty array when no ports are registered', () => {
      expect(registry.getEntries()).toEqual([])
    })

    it('should return all port-state pairs', () => {
      registry.register(port1, state1)
      registry.register(port2, state2)
      const entries = registry.getEntries()
      expect(entries).toHaveLength(2)
      expect(entries).toContainEqual([port1, state1])
      expect(entries).toContainEqual([port2, state2])
    })
  })

  describe('getTotal', () => {
    it('should return 0 for an empty registry', () => {
      expect(registry.getTotal()).toBe(0)
    })

    it('should return the correct count of registered ports', () => {
      registry.register(port1, state1)
      expect(registry.getTotal()).toBe(1)
      registry.register(port2, state2)
      expect(registry.getTotal()).toBe(2)
    })
  })

  describe('getActiveCount', () => {
    it('should return 0 when no ports are registered', () => {
      expect(registry.getActiveCount()).toBe(0)
    })

    it('should return the count of visible ports', () => {
      registry.register(port1, state1) // visible: true
      registry.register(port2, state2) // visible: false
      expect(registry.getActiveCount()).toBe(1)
    })

    it('should return 0 when all ports are hidden', () => {
      const hiddenState: ClientState = {
        visible: false,
        lastPong: Date.now(),
        controller: new AbortController(),
      }
      registry.register(port1, hiddenState)
      registry.register(port2, hiddenState)
      expect(registry.getActiveCount()).toBe(0)
    })

    it('should count all ports when all are visible', () => {
      const visibleState: ClientState = {
        visible: true,
        lastPong: Date.now(),
        controller: new AbortController(),
      }
      registry.register(port1, visibleState)
      registry.register(port2, visibleState)
      expect(registry.getActiveCount()).toBe(2)
    })
  })

  describe('clear', () => {
    it('should remove all registered ports', () => {
      registry.register(port1, state1)
      registry.register(port2, state2)
      registry.clear()
      expect(registry.getTotal()).toBe(0)
      expect(registry.has(port1)).toBe(false)
      expect(registry.has(port2)).toBe(false)
    })

    it('should do nothing when called on an empty registry', () => {
      registry.clear()
      expect(registry.getTotal()).toBe(0)
    })
  })
})
