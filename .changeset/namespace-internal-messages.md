---
"shared-worker-utils": minor
---

Namespace internal message types to prevent collision with user types

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
