---
"shared-worker-utils": major
---

Initial release of shared-worker-utils with full TypeScript support and generic message types.

## Features

- **PortManager**: Manages MessagePort connections in SharedWorker with automatic heartbeat, visibility tracking, and client count management
- **PortWrapper**: Client-side wrapper for SharedWorker connections with automatic visibility detection and ping responses
- **Type Safety**: Full generic type support for application messages with `PortManager<TMessage>` and `PortWrapper<TMessage>`
- **Internal Message Filtering**: Automatically filters internal messages (ping, pong, client-count, visibility-change, disconnect) from application callbacks
- **Resource Optimization**: Automatic connection management based on client visibility
- **Comprehensive Testing**: 26 unit tests with full coverage

## Breaking Changes

- Library uses generic type parameters - migrate by specifying message types: `new PortManager<YourMessageType>()`
- `onCustomMessage` renamed to `onMessage`
- Internal messages are now automatically filtered from application callbacks
- All `any` types replaced with typed generics or `unknown`

## API

- `PortManager<TMessage>` - SharedWorker-side port management
- `PortWrapper<TMessage>` - Client-side port wrapper
- Full TypeScript support with exported types
- ESM-only module format
