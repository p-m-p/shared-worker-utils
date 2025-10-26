---
"shared-worker-utils": major
---

BREAKING CHANGE: Rename PortWrapper to SharedWorkerClient

- **Class renamed**: `PortWrapper` → `SharedWorkerClient`
- **Interface renamed**: `PortWrapperOptions` → `SharedWorkerClientOptions`
- **Export updated**: Import path remains the same, but class name has changed

**Migration Guide:**

Before:
```typescript
import { PortWrapper } from 'shared-worker-utils';

const wrapper = new PortWrapper(worker, { onMessage });
```

After:
```typescript
import { SharedWorkerClient } from 'shared-worker-utils';

const client = new SharedWorkerClient(worker, { onMessage });
```

The new name better reflects the purpose of the class and follows industry conventions (e.g., WebSocketClient, HttpClient).
