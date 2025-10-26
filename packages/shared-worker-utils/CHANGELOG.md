# shared-worker-utils

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
