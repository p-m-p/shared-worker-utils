---
"shared-worker-utils": minor
---

Add stale client management with optional auto-removal and manual cleanup

- Add `staleClientTimeout` option to auto-remove stale clients after a specified duration
- Add `getStaleClientCount()` method to get the count of stale clients
- Add `removeStaleClients()` method to manually remove all stale clients
- Stale clients are now tracked separately and automatically reconnect when they send messages
- Stale clients are excluded from broadcasts, getTotalCount(), and getActiveCount()
- Update documentation with comprehensive examples and explanations
