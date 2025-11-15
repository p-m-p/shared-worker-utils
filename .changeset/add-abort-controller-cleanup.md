---
"shared-worker-utils": minor
---

Add proper event listener cleanup using AbortController signals

Event listeners in both `SharedWorkerClient` and `PortManager` now use AbortController signals for automatic cleanup, preventing memory leaks when clients disconnect or are destroyed.

**Changes:**

- `SharedWorkerClient`: Added `destroy()` method that properly cleans up all event listeners (message, visibilitychange, beforeunload) and closes the MessagePort
- `PortManager`: Each client connection now has its own AbortController that is aborted when the client disconnects, becomes stale, or when the manager is destroyed
- `ClientState`: Added `controller` property to track the AbortController for each client

**Benefits:**
- Eliminates memory leaks from orphaned event listeners
- Cleaner resource management with automatic cleanup
- More robust lifecycle handling
