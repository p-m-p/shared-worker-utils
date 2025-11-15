import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageHandler } from '../src/port/message-handler'

// Mock MessagePort
class MockMessagePort {
  id: string
  constructor(id: string) {
    this.id = id
  }
}

interface TestMessage {
  type: string
  data?: string
}

describe('MessageHandler', () => {
  let handler: MessageHandler<MockMessagePort, TestMessage>
  let port: MockMessagePort
  let callbacks: {
    onVisibilityChange: ReturnType<typeof vi.fn>
    onDisconnect: ReturnType<typeof vi.fn>
    onPong: ReturnType<typeof vi.fn>
    onAppMessage: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    port = new MockMessagePort('port1')
    callbacks = {
      onVisibilityChange: vi.fn(),
      onDisconnect: vi.fn(),
      onPong: vi.fn(),
      onAppMessage: vi.fn(),
    }
    handler = new MessageHandler(callbacks)
  })

  describe('handle', () => {
    it('should call onVisibilityChange for visibility-change messages', () => {
      handler.handle(port, {
        type: '@shared-worker-utils/visibility-change',
        visible: false,
      })

      expect(callbacks.onVisibilityChange).toHaveBeenCalledWith(port, false)
      expect(callbacks.onDisconnect).not.toHaveBeenCalled()
      expect(callbacks.onPong).not.toHaveBeenCalled()
      expect(callbacks.onAppMessage).not.toHaveBeenCalled()
    })

    it('should call onVisibilityChange with true if visible is not provided', () => {
      handler.handle(port, {
        type: '@shared-worker-utils/visibility-change',
      })

      expect(callbacks.onVisibilityChange).toHaveBeenCalledWith(port, true)
    })

    it('should call onDisconnect for disconnect messages', () => {
      handler.handle(port, {
        type: '@shared-worker-utils/disconnect',
      })

      expect(callbacks.onDisconnect).toHaveBeenCalledWith(port)
      expect(callbacks.onVisibilityChange).not.toHaveBeenCalled()
      expect(callbacks.onPong).not.toHaveBeenCalled()
      expect(callbacks.onAppMessage).not.toHaveBeenCalled()
    })

    it('should call onPong for pong messages', () => {
      handler.handle(port, {
        type: '@shared-worker-utils/pong',
      })

      expect(callbacks.onPong).toHaveBeenCalledWith(port)
      expect(callbacks.onVisibilityChange).not.toHaveBeenCalled()
      expect(callbacks.onDisconnect).not.toHaveBeenCalled()
      expect(callbacks.onAppMessage).not.toHaveBeenCalled()
    })

    it('should call onAppMessage for non-internal messages', () => {
      const appMessage: TestMessage = {
        type: 'custom',
        data: 'test data',
      }
      handler.handle(port, appMessage)

      expect(callbacks.onAppMessage).toHaveBeenCalledWith(port, appMessage)
      expect(callbacks.onVisibilityChange).not.toHaveBeenCalled()
      expect(callbacks.onDisconnect).not.toHaveBeenCalled()
      expect(callbacks.onPong).not.toHaveBeenCalled()
    })

    it('should call onAppMessage for messages without a type', () => {
      const message = { data: 'no type' }
      handler.handle(port, message)

      expect(callbacks.onAppMessage).toHaveBeenCalledWith(port, message)
    })

    it('should call onAppMessage for ping messages (not handled as internal)', () => {
      // Ping messages should not be handled by the client-side handler
      const pingMessage = { type: '@shared-worker-utils/ping' }
      handler.handle(port, pingMessage)

      expect(callbacks.onAppMessage).toHaveBeenCalledWith(port, pingMessage)
      expect(callbacks.onVisibilityChange).not.toHaveBeenCalled()
      expect(callbacks.onDisconnect).not.toHaveBeenCalled()
      expect(callbacks.onPong).not.toHaveBeenCalled()
    })

    it('should call onAppMessage for client-count messages', () => {
      // Client count messages should not be handled by this handler
      const countMessage = {
        type: '@shared-worker-utils/client-count',
        total: 5,
        active: 3,
      }
      handler.handle(port, countMessage)

      expect(callbacks.onAppMessage).toHaveBeenCalledWith(port, countMessage)
    })
  })

  describe('optional callbacks', () => {
    it('should not throw if onVisibilityChange is not provided', () => {
      const handlerWithoutCallback = new MessageHandler<
        MockMessagePort,
        TestMessage
      >({})

      expect(() =>
        handlerWithoutCallback.handle(port, {
          type: '@shared-worker-utils/visibility-change',
          visible: false,
        })
      ).not.toThrow()
    })

    it('should not throw if onDisconnect is not provided', () => {
      const handlerWithoutCallback = new MessageHandler<
        MockMessagePort,
        TestMessage
      >({})

      expect(() =>
        handlerWithoutCallback.handle(port, {
          type: '@shared-worker-utils/disconnect',
        })
      ).not.toThrow()
    })

    it('should not throw if onPong is not provided', () => {
      const handlerWithoutCallback = new MessageHandler<
        MockMessagePort,
        TestMessage
      >({})

      expect(() =>
        handlerWithoutCallback.handle(port, {
          type: '@shared-worker-utils/pong',
        })
      ).not.toThrow()
    })

    it('should not throw if onAppMessage is not provided', () => {
      const handlerWithoutCallback = new MessageHandler<
        MockMessagePort,
        TestMessage
      >({})

      expect(() =>
        handlerWithoutCallback.handle(port, {
          type: 'custom',
          data: 'test',
        })
      ).not.toThrow()
    })
  })
})
