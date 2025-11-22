---
'shared-worker-utils': major
---

BREAKING CHANGE: Renamed PortManager.getStaleClientCount() to getStaleCount() for API consistency

## What Changed

The `PortManager.getStaleClientCount()` method has been renamed to `getStaleCount()` to maintain a consistent naming convention within the `PortManager` class.

## Why This Change Was Made

The `PortManager` class getter methods should follow a consistent naming pattern without redundant "Client" in the method name:
- `getActiveCount()` - returns count of active clients
- `getTotalCount()` - returns count of total clients
- `getStaleCount()` - returns count of stale clients (previously `getStaleClientCount()`)

The "Client" suffix in `getStaleClientCount()` was redundant since the `PortManager` class exclusively manages clients. This change makes the API more consistent and easier to remember.

## How to Update Your Code

If you are using the `getStaleClientCount()` method in your code, simply rename it to `getStaleCount()`:

**Before:**
```typescript
const staleCount = portManager.getStaleClientCount()
if (portManager.getStaleClientCount() > 0) {
  portManager.removeStaleClients()
}
```

**After:**
```typescript
const staleCount = portManager.getStaleCount()
if (portManager.getStaleCount() > 0) {
  portManager.removeStaleClients()
}
```
