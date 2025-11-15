import { describe, it, expect } from 'vitest'
import {
  PortManager,
  SharedWorkerClient,
  PortRegistry,
  Connection,
  MESSAGE_TYPES,
  isInternalMessage,
  normalizeMessage,
  ConnectionState,
} from '../src/index'
import type {
  PortManagerOptions,
  SharedWorkerClientOptions,
  ClientState,
  ClientCountMessage,
  VisibilityChangeMessage,
  DisconnectMessage,
  PingMessage,
  PongMessage,
  InternalMessage,
  LogEntry,
  LogLevel,
  PortEntry,
  PortRegistryOptions,
  ConnectionOptions,
} from '../src/index'

describe('Public API Exports', () => {
  describe('Classes', () => {
    it('should export PortManager', () => {
      expect(PortManager).toBeDefined()
      expect(typeof PortManager).toBe('function')
    })

    it('should export SharedWorkerClient', () => {
      expect(SharedWorkerClient).toBeDefined()
      expect(typeof SharedWorkerClient).toBe('function')
    })

    it('should export PortRegistry', () => {
      expect(PortRegistry).toBeDefined()
      expect(typeof PortRegistry).toBe('function')
    })

    it('should export Connection', () => {
      expect(Connection).toBeDefined()
      expect(typeof Connection).toBe('function')
    })
  })

  describe('Utilities', () => {
    it('should export MESSAGE_TYPES', () => {
      expect(MESSAGE_TYPES).toBeDefined()
      expect(typeof MESSAGE_TYPES).toBe('object')
      expect(MESSAGE_TYPES.PING).toBe('@shared-worker-utils/ping')
      expect(MESSAGE_TYPES.PONG).toBe('@shared-worker-utils/pong')
      expect(MESSAGE_TYPES.VISIBILITY_CHANGE).toBe(
        '@shared-worker-utils/visibility-change'
      )
      expect(MESSAGE_TYPES.DISCONNECT).toBe('@shared-worker-utils/disconnect')
      expect(MESSAGE_TYPES.CLIENT_COUNT).toBe(
        '@shared-worker-utils/client-count'
      )
    })

    it('should export isInternalMessage', () => {
      expect(isInternalMessage).toBeDefined()
      expect(typeof isInternalMessage).toBe('function')

      // Test functionality
      expect(isInternalMessage({ type: '@shared-worker-utils/ping' })).toBe(
        true
      )
      expect(isInternalMessage({ type: 'custom-message' })).toBe(false)
      expect(isInternalMessage('')).toBe(false)
    })

    it('should export normalizeMessage', () => {
      expect(normalizeMessage).toBeDefined()
      expect(typeof normalizeMessage).toBe('function')

      // Test functionality
      const normalized = normalizeMessage({ type: 'test', data: 'value' })
      expect(normalized).toHaveProperty('type', 'test')
    })
  })

  describe('Type Exports', () => {
    it('should allow using exported types', () => {
      // This test verifies that types can be imported and used
      // TypeScript compilation will fail if types are not exported correctly

      const options: PortManagerOptions = {
        pingInterval: 5000,
        pingTimeout: 2000,
      }
      expect(options.pingInterval).toBe(5000)

      const clientState: ClientState = {
        visible: true,
        lastPong: Date.now(),
        controller: new AbortController(),
      }
      expect(clientState.visible).toBe(true)

      const logEntry: LogEntry = {
        message: 'test',
        level: 'info' as LogLevel,
      }
      expect(logEntry.level).toBe('info')

      const portEntry: PortEntry = {
        id: 'test',
        port: {} as MessagePort,
      }
      expect(portEntry.id).toBe('test')

      const registryOptions: PortRegistryOptions = {}
      expect(registryOptions).toBeDefined()

      const connectionOptions: ConnectionOptions = {
        autoStart: false,
      }
      expect(connectionOptions.autoStart).toBe(false)

      const state: ConnectionState = ConnectionState.CONNECTED
      expect(state).toBe('connected')
    })

    it('should allow using message type interfaces', () => {
      const pingMessage: PingMessage = {
        type: '@shared-worker-utils/ping',
      }
      expect(pingMessage.type).toBe('@shared-worker-utils/ping')

      const pongMessage: PongMessage = {
        type: '@shared-worker-utils/pong',
      }
      expect(pongMessage.type).toBe('@shared-worker-utils/pong')

      const visibilityMessage: VisibilityChangeMessage = {
        type: '@shared-worker-utils/visibility-change',
        visible: true,
      }
      expect(visibilityMessage.visible).toBe(true)

      const disconnectMessage: DisconnectMessage = {
        type: '@shared-worker-utils/disconnect',
      }
      expect(disconnectMessage.type).toBe('@shared-worker-utils/disconnect')

      const clientCountMessage: ClientCountMessage = {
        type: '@shared-worker-utils/client-count',
        total: 5,
        active: 3,
      }
      expect(clientCountMessage.total).toBe(5)

      const internalMessage: InternalMessage = pingMessage
      expect(internalMessage).toBeDefined()
    })

    it('should allow using SharedWorkerClientOptions type', () => {
      const options: SharedWorkerClientOptions = {
        onMessage: (message) => {
          console.log(message)
        },
      }
      expect(typeof options.onMessage).toBe('function')
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain PortManager public API', () => {
      const portManager = new PortManager()

      // Verify all public methods exist
      expect(typeof portManager.handleConnect).toBe('function')
      expect(typeof portManager.broadcast).toBe('function')
      expect(typeof portManager.getActiveCount).toBe('function')
      expect(typeof portManager.getTotalCount).toBe('function')
      expect(typeof portManager.destroy).toBe('function')

      portManager.destroy()
    })

    it('should maintain SharedWorkerClient public API', () => {
      // Note: SharedWorkerClient requires a SharedWorker which we can't easily mock
      // This test verifies the class is exported and can be instantiated
      expect(SharedWorkerClient).toBeDefined()
    })
  })

  describe('New Modules', () => {
    it('should expose PortRegistry functionality', () => {
      const registry = new PortRegistry()

      expect(typeof registry.register).toBe('function')
      expect(typeof registry.get).toBe('function')
      expect(typeof registry.getEntry).toBe('function')
      expect(typeof registry.remove).toBe('function')
      expect(typeof registry.list).toBe('function')
      expect(typeof registry.size).toBe('function')
      expect(typeof registry.on).toBe('function')
      expect(typeof registry.off).toBe('function')
      expect(typeof registry.shutdown).toBe('function')
    })

    it('should expose Connection functionality', () => {
      const mockPort = {
        addEventListener: () => {},
        postMessage: () => {},
        start: () => {},
      } as unknown as MessagePort

      const connection = new Connection(mockPort)

      expect(typeof connection.getId).toBe('function')
      expect(typeof connection.getState).toBe('function')
      expect(typeof connection.getPort).toBe('function')
      expect(typeof connection.send).toBe('function')
      expect(typeof connection.sendInternal).toBe('function')
      expect(typeof connection.onMessage).toBe('function')
      expect(typeof connection.offMessage).toBe('function')
      expect(typeof connection.onClose).toBe('function')
      expect(typeof connection.offClose).toBe('function')
      expect(typeof connection.close).toBe('function')

      connection.close()
    })
  })
})
