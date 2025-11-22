---
'shared-worker-utils': major
---

BREAKING CHANGE: Renamed SharedWorkerClient.isVisible() to getIsVisible() for API consistency with PortManager

## What Changed

The `SharedWorkerClient.isVisible()` method has been renamed to `getIsVisible()` to maintain a consistent naming convention with the `PortManager` class.

## Why This Change Was Made

The `PortManager` class uses a consistent "get" prefix for all its getter methods:
- `getActiveCount()`
- `getTotalCount()`
- `getStaleClientCount()`

The `SharedWorkerClient.isVisible()` method did not follow this pattern, creating an inconsistency in the API. This change makes the API more predictable and easier to learn.

## How to Update Your Code

If you are using the `isVisible()` method in your code, simply rename it to `getIsVisible()`:

**Before:**
```typescript
if (client.isVisible()) {
  // Tab is visible
}
```

**After:**
```typescript
if (client.getIsVisible()) {
  // Tab is visible
}
```
