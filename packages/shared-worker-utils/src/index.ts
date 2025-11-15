export { PortManager } from './port-manager'
export { SharedWorkerClient } from './shared-worker-client'
export { PortRegistry } from './port/registry'
export { Connection } from './port/connection'
export {
  MESSAGE_TYPES,
  isInternalMessage,
  normalizeMessage,
} from './port/utilities'
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
