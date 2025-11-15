import { describe, it, expect, beforeEach } from 'vitest'
import { PortRegistry } from '../src/port/registry'

// Mock MessagePort for testing
class MockMessagePort {
  lastMessage?: unknown

  postMessage(data: unknown) {
    this.lastMessage = data
  }

  start() {
    // No-op for mock
  }
}

describe('PortRegistry', () => {
  let registry: PortRegistry<MessagePort>
  let port1: MockMessagePort
  let port2: MockMessagePort

  beforeEach(() => {
    registry = new PortRegistry()
    port1 = new MockMessagePort() as unknown as MessagePort
    port2 = new MockMessagePort() as unknown as MessagePort
  })

  describe('register', () => {
    it('should register a new port with default metadata', () => {
      const result = registry.register(port1 as unknown as MessagePort)

      expect(result).toBe(port1)
      expect(registry.has(port1 as unknown as MessagePort)).toBe(true)
      expect(registry.size()).toBe(1)
    })

    it('should register a port with custom metadata', () => {
      const customMeta = { visible: false, lastPong: 12_345 }
      registry.register(port1 as unknown as MessagePort, customMeta)

      const state = registry.get(port1 as unknown as MessagePort)
      expect(state?.visible).toBe(false)
      expect(state?.lastPong).toBe(12_345)
    })

    it('should create an AbortController for each registered port', () => {
      registry.register(port1 as unknown as MessagePort)

      const state = registry.get(port1 as unknown as MessagePort)
      expect(state?.controller).toBeInstanceOf(AbortController)
    })

    it('should allow registering multiple ports', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      expect(registry.size()).toBe(2)
      expect(registry.has(port1 as unknown as MessagePort)).toBe(true)
      expect(registry.has(port2 as unknown as MessagePort)).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should unregister a port and return true', () => {
      registry.register(port1 as unknown as MessagePort)

      const result = registry.unregister(port1 as unknown as MessagePort)

      expect(result).toBe(true)
      expect(registry.has(port1 as unknown as MessagePort)).toBe(false)
      expect(registry.size()).toBe(0)
    })

    it('should abort the controller when unregistering', () => {
      registry.register(port1 as unknown as MessagePort)
      const state = registry.get(port1 as unknown as MessagePort)
      const controller = state?.controller

      registry.unregister(port1 as unknown as MessagePort)

      expect(controller?.signal.aborted).toBe(true)
    })

    it('should return false when unregistering a non-existent port', () => {
      const result = registry.unregister(port1 as unknown as MessagePort)

      expect(result).toBe(false)
    })
  })

  describe('get', () => {
    it('should return metadata for a registered port', () => {
      registry.register(port1 as unknown as MessagePort)

      const state = registry.get(port1 as unknown as MessagePort)

      expect(state).toBeDefined()
      expect(state?.visible).toBe(true)
      expect(state?.lastPong).toBeGreaterThan(0)
    })

    it('should return undefined for a non-existent port', () => {
      const state = registry.get(port1 as unknown as MessagePort)

      expect(state).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for a registered port', () => {
      registry.register(port1 as unknown as MessagePort)

      expect(registry.has(port1 as unknown as MessagePort)).toBe(true)
    })

    it('should return false for a non-existent port', () => {
      expect(registry.has(port1 as unknown as MessagePort)).toBe(false)
    })
  })

  describe('size', () => {
    it('should return 0 for an empty registry', () => {
      expect(registry.size()).toBe(0)
    })

    it('should return the correct count of registered ports', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      expect(registry.size()).toBe(2)
    })
  })

  describe('countVisible', () => {
    it('should count only visible ports', () => {
      registry.register(port1 as unknown as MessagePort, { visible: true })
      registry.register(port2 as unknown as MessagePort, { visible: false })

      expect(registry.countVisible()).toBe(1)
    })

    it('should return 0 when no ports are visible', () => {
      registry.register(port1 as unknown as MessagePort, { visible: false })
      registry.register(port2 as unknown as MessagePort, { visible: false })

      expect(registry.countVisible()).toBe(0)
    })

    it('should update count when visibility changes', () => {
      registry.register(port1 as unknown as MessagePort, { visible: true })
      expect(registry.countVisible()).toBe(1)

      const state = registry.get(port1 as unknown as MessagePort)
      if (state) {
        state.visible = false
      }

      expect(registry.countVisible()).toBe(0)
    })
  })

  describe('entries', () => {
    it('should iterate over all registered ports', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      const entries = [...registry.entries()]

      expect(entries.length).toBe(2)
      expect(entries[0][0]).toBe(port1)
      expect(entries[1][0]).toBe(port2)
    })

    it('should return an empty iterator for an empty registry', () => {
      const entries = [...registry.entries()]

      expect(entries.length).toBe(0)
    })
  })

  describe('keys', () => {
    it('should iterate over all port keys', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      const keys = [...registry.keys()]

      expect(keys.length).toBe(2)
      expect(keys).toContain(port1)
      expect(keys).toContain(port2)
    })
  })

  describe('clear', () => {
    it('should remove all ports from the registry', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      registry.clear()

      expect(registry.size()).toBe(0)
    })

    it('should abort all controllers when clearing', () => {
      registry.register(port1 as unknown as MessagePort)
      registry.register(port2 as unknown as MessagePort)

      const state1 = registry.get(port1 as unknown as MessagePort)
      const state2 = registry.get(port2 as unknown as MessagePort)

      registry.clear()

      expect(state1?.controller.signal.aborted).toBe(true)
      expect(state2?.controller.signal.aborted).toBe(true)
    })
  })
})
