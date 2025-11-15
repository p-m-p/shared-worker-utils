import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeartbeatManager } from '../src/port/heartbeat'
import type { ClientState } from '../src/types'

// Mock MessagePort
class MockMessagePort {
  id: string
  constructor(id: string) {
    this.id = id
  }
}

describe('HeartbeatManager', () => {
  let heartbeat: HeartbeatManager<MockMessagePort>
  let port1: MockMessagePort
  let port2: MockMessagePort
  let callbacks: {
    onStalePort: ReturnType<typeof vi.fn>
    onPing: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    port1 = new MockMessagePort('port1')
    port2 = new MockMessagePort('port2')
    callbacks = {
      onStalePort: vi.fn(),
      onPing: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    heartbeat?.stop()
  })

  describe('checkPorts', () => {
    it('should identify stale ports that have not ponged recently', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        callbacks
      )

      const now = Date.now()
      const staleTime = now - 16_000 // Older than pingInterval + pingTimeout
      const freshTime = now - 5000

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: staleTime,
            controller: new AbortController(),
          },
        ],
        [
          port2,
          {
            visible: true,
            lastPong: freshTime,
            controller: new AbortController(),
          },
        ],
      ]

      const stalePorts = heartbeat.checkPorts(entries)

      expect(stalePorts).toContain(port1)
      expect(stalePorts).not.toContain(port2)
      expect(stalePorts).toHaveLength(1)
    })

    it('should send ping to fresh ports', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        callbacks
      )

      const now = Date.now()
      const freshTime = now - 5000

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: freshTime,
            controller: new AbortController(),
          },
        ],
      ]

      heartbeat.checkPorts(entries)

      expect(callbacks.onPing).toHaveBeenCalledWith(port1)
    })

    it('should call onStalePort callback for stale ports', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        callbacks
      )

      const now = Date.now()
      const staleTime = now - 20_000

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: staleTime,
            controller: new AbortController(),
          },
        ],
      ]

      heartbeat.checkPorts(entries)

      expect(callbacks.onStalePort).toHaveBeenCalledWith(port1)
    })

    it('should handle empty entries', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        callbacks
      )

      const stalePorts = heartbeat.checkPorts([])

      expect(stalePorts).toEqual([])
      expect(callbacks.onPing).not.toHaveBeenCalled()
      expect(callbacks.onStalePort).not.toHaveBeenCalled()
    })

    it('should correctly calculate stale threshold', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 8000, pingTimeout: 3000 },
        callbacks
      )

      const now = Date.now()
      // Threshold is 8000 + 3000 = 11000
      const justStaleTime = now - 11_001
      const justFreshTime = now - 10_999

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: justStaleTime,
            controller: new AbortController(),
          },
        ],
        [
          port2,
          {
            visible: true,
            lastPong: justFreshTime,
            controller: new AbortController(),
          },
        ],
      ]

      const stalePorts = heartbeat.checkPorts(entries)

      expect(stalePorts).toContain(port1)
      expect(stalePorts).not.toContain(port2)
    })
  })

  describe('onInterval', () => {
    it('should call the callback at specified intervals', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 5000, pingTimeout: 2000 },
        callbacks
      )

      const intervalCallback = vi.fn()
      heartbeat.onInterval(intervalCallback)

      expect(intervalCallback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(5000)
      expect(intervalCallback).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(5000)
      expect(intervalCallback).toHaveBeenCalledTimes(2)
    })

    it('should replace the existing interval', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 5000, pingTimeout: 2000 },
        callbacks
      )

      const firstCallback = vi.fn()
      const secondCallback = vi.fn()

      heartbeat.onInterval(firstCallback)
      vi.advanceTimersByTime(5000)
      expect(firstCallback).toHaveBeenCalledTimes(1)

      // Replace interval
      heartbeat.onInterval(secondCallback)
      vi.advanceTimersByTime(5000)

      // First callback should not be called again
      expect(firstCallback).toHaveBeenCalledTimes(1)
      expect(secondCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop', () => {
    it('should stop the heartbeat interval', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 5000, pingTimeout: 2000 },
        callbacks
      )

      const intervalCallback = vi.fn()
      heartbeat.onInterval(intervalCallback)

      vi.advanceTimersByTime(5000)
      expect(intervalCallback).toHaveBeenCalledTimes(1)

      heartbeat.stop()

      vi.advanceTimersByTime(10_000)
      // Should not be called again after stop
      expect(intervalCallback).toHaveBeenCalledTimes(1)
    })

    it('should be safe to call multiple times', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 5000, pingTimeout: 2000 },
        callbacks
      )

      expect(() => {
        heartbeat.stop()
        heartbeat.stop()
      }).not.toThrow()
    })
  })

  describe('optional callbacks', () => {
    it('should not throw if onStalePort is not provided', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        {}
      )

      const now = Date.now()
      const staleTime = now - 20_000

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: staleTime,
            controller: new AbortController(),
          },
        ],
      ]

      expect(() => heartbeat.checkPorts(entries)).not.toThrow()
    })

    it('should not throw if onPing is not provided', () => {
      heartbeat = new HeartbeatManager(
        { pingInterval: 10_000, pingTimeout: 5000 },
        {}
      )

      const now = Date.now()
      const freshTime = now - 5000

      const entries: Array<[MockMessagePort, ClientState]> = [
        [
          port1,
          {
            visible: true,
            lastPong: freshTime,
            controller: new AbortController(),
          },
        ],
      ]

      expect(() => heartbeat.checkPorts(entries)).not.toThrow()
    })
  })
})
