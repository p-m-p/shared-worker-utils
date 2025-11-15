export { PortManager } from './port-manager'
export { SharedWorkerClient } from './shared-worker-client'
export { PortRegistry } from './port/registry'
export { Connection } from './port/connection'
export type { MessagePortLike } from './port/connection'
export type {
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
  ConnectionState,
} from './types'
