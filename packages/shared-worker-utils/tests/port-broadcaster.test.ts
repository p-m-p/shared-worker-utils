import { describe, it, expect, beforeEach } from 'vitest'
import { Broadcaster } from '../src/port/broadcaster'

// Mock MessagePort
class MockMessagePort {
  id: string
  lastMessage?: unknown

  constructor(id: string) {
    this.id = id
  }

  postMessage(data: unknown) {
    this.lastMessage = data
  }
}

describe('Broadcaster', () => {
  let broadcaster: Broadcaster<MockMessagePort>
  let port1: MockMessagePort
  let port2: MockMessagePort
  let port3: MockMessagePort

  beforeEach(() => {
    broadcaster = new Broadcaster()
    port1 = new MockMessagePort('port1')
    port2 = new MockMessagePort('port2')
    port3 = new MockMessagePort('port3')
  })

  describe('broadcast', () => {
    it('should send message to all provided ports', () => {
      const message = { type: 'test', data: 'hello' }
      broadcaster.broadcast([port1, port2, port3], message)

      expect(port1.lastMessage).toEqual(message)
      expect(port2.lastMessage).toEqual(message)
      expect(port3.lastMessage).toEqual(message)
    })

    it('should handle an empty port array', () => {
      const message = { type: 'test' }
      broadcaster.broadcast([], message)
      // Should not throw
    })

    it('should handle a single port', () => {
      const message = { type: 'test', data: 'single' }
      broadcaster.broadcast([port1], message)

      expect(port1.lastMessage).toEqual(message)
      expect(port2.lastMessage).toBeUndefined()
    })

    it('should broadcast different message types', () => {
      const stringMessage = 'hello'
      broadcaster.broadcast([port1], stringMessage)
      expect(port1.lastMessage).toBe(stringMessage)

      const numberMessage = 42
      broadcaster.broadcast([port2], numberMessage)
      expect(port2.lastMessage).toBe(numberMessage)

      const objectMessage = { key: 'value', nested: { data: true } }
      broadcaster.broadcast([port3], objectMessage)
      expect(port3.lastMessage).toEqual(objectMessage)
    })
  })

  describe('send', () => {
    it('should send message to a single port', () => {
      const message = { type: 'direct', data: 'message' }
      broadcaster.send(port1, message)

      expect(port1.lastMessage).toEqual(message)
      expect(port2.lastMessage).toBeUndefined()
    })

    it('should handle different message types', () => {
      broadcaster.send(port1, 'string')
      expect(port1.lastMessage).toBe('string')

      broadcaster.send(port2, { complex: { object: true } })
      expect(port2.lastMessage).toEqual({ complex: { object: true } })
    })

    it('should allow sending to the same port multiple times', () => {
      broadcaster.send(port1, 'first')
      expect(port1.lastMessage).toBe('first')

      broadcaster.send(port1, 'second')
      expect(port1.lastMessage).toBe('second')
    })
  })
})
