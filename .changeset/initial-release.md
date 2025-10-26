---
"shared-worker-utils": minor
---

Add TypeScript generic type support and improve type safety

- Added generic type parameters to `PortManager<TMessage>` and `PortWrapper<TMessage>` for type-safe message handling
- Replaced all `any` types with `unknown` or typed generics
- Renamed `onCustomMessage` to `onMessage` for clarity
- Internal messages (ping, pong, client-count, etc.) are now automatically filtered from application callbacks
- Added MIT License
