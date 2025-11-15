# shared-worker-utils

## 2.1.0

### Minor Changes

- 7c89036: Add proper event listener cleanup using AbortController signals

  Event listeners in both `SharedWorkerClient` and `PortManager` now use AbortController signals for automatic cleanup, preventing memory leaks when clients disconnect or are destroyed.

  **Changes:**
  - `SharedWorkerClient`: Added `destroy()` method that properly cleans up all event listeners (message, visibilitychange, beforeunload) and closes the MessagePort
  - `PortManager`: Each client connection now has its own AbortController that is aborted when the client disconnects, becomes stale, or when the manager is destroyed
  - `ClientState`: Added `controller` property to track the AbortController for each client

  **Benefits:**
  - Eliminates memory leaks from orphaned event listeners
  - Cleaner resource management with automatic cleanup
  - More robust lifecycle handling

## 2.0.0

### Major Changes

- 91ba198: BREAKING CHANGE: Refactor logging to use structured format

  The `onLog` callback now receives a structured `LogEntry` object instead of string arguments, enabling better integration with logging systems and improved queryability.

  **Migration Guide:**

  Before:

  ```typescript
  new PortManager({
    onLog: (message, ...args) => {
      console.log(message, ...args)
    },
  })
  ```

  After:

  ```typescript
  new PortManager({
    onLog: (logEntry) => {
      // logEntry has: message, level, context?
      console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}`)
    },
  })
  ```

  **What Changed:**
  - Added `LogEntry` interface: `{ message: string, level: LogLevel, context?: Record<string, unknown> }`
  - Added `LogLevel` type: `'info' | 'debug' | 'warn' | 'error'`
  - `onLog` signature changed from `(message: string, ...parameters: unknown[]) => void` to `(logEntry: LogEntry) => void`
  - Context data now in separate field (e.g., `{ totalClients: 1 }`, `{ visible: false }`)
  - Log levels assigned: `'info'` for state changes, `'debug'` for routine operations

  **Benefits:**
  - Structured logging with typed fields for better tooling support
  - Easy integration with log aggregators and monitoring systems
  - Context data in separate field for better queryability
  - Consistent log format across all library messages
  - Type-safe logging with full TypeScript support

## 1.1.0

### Minor Changes

- 828bfeb: Namespace internal message types to prevent collision with user types

  Internal message types are now prefixed with `@shared-worker-utils/` to ensure they cannot collide with user-defined application message types:
  - `ping` → `@shared-worker-utils/ping`
  - `pong` → `@shared-worker-utils/pong`
  - `disconnect` → `@shared-worker-utils/disconnect`
  - `visibility-change` → `@shared-worker-utils/visibility-change`
  - `client-count` → `@shared-worker-utils/client-count`

  **Impact:** This change is transparent to users since internal messages are automatically filtered out by the library. Users should not be affected unless they were manually inspecting or relying on internal message formats, which was not part of the public API.

  **Benefits:**
  - Zero collision risk with user message types
  - Clear separation between internal and application messages
  - More robust and future-proof architecture

## 1.0.0

### Major Changes

- d9fdf14: BREAKING CHANGE: Rename PortWrapper to SharedWorkerClient
  - **Class renamed**: `PortWrapper` → `SharedWorkerClient`
  - **Interface renamed**: `PortWrapperOptions` → `SharedWorkerClientOptions`
  - **Export updated**: Import path remains the same, but class name has changed

  **Migration Guide:**

  Before:

  ```typescript
  import { PortWrapper } from 'shared-worker-utils'

  const wrapper = new PortWrapper(worker, { onMessage })
  ```

  After:

  ```typescript
  import { SharedWorkerClient } from 'shared-worker-utils'

  const client = new SharedWorkerClient(worker, { onMessage })
  ```

  The new name better reflects the purpose of the class and follows industry conventions (e.g., WebSocketClient, HttpClient).

## 0.2.0

### Minor Changes

- 14eba0b: Add TypeScript generic type support and improve type safety
  - Added generic type parameters to `PortManager<TMessage>` and `PortWrapper<TMessage>` for type-safe message handling
  - Replaced all `any` types with `unknown` or typed generics
  - Renamed `onCustomMessage` to `onMessage` for clarity
  - Internal messages (ping, pong, client-count, etc.) are now automatically filtered from application callbacks
  - Added MIT License
