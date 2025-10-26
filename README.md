# SharedWorker Utilities & Demo

A TypeScript library and demo for managing SharedWorker connections with automatic heartbeat, visibility tracking, and resource optimization.

## Repository Structure

This is a pnpm workspace monorepo containing:

- **[shared-worker-utils](./packages/shared-worker-utils)** - Reusable library for managing SharedWorker port connections
- **[example](./packages/example)** - Demo application showing real-time stock prices shared across browser tabs

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Run the Demo

1. Start the WebSocket server:
```bash
pnpm server
```

2. In a separate terminal, start the dev server:
```bash
pnpm dev
```

3. Open http://localhost:5173 in multiple browser tabs to see the SharedWorker in action!

### Run Tests

```bash
pnpm test
```

### Build

```bash
pnpm build
```

## What's Included

### shared-worker-utils Library

A lightweight library providing:

- **PortManager** (SharedWorker side) - Manages MessagePort connections with:
  - Automatic ping/pong heartbeat to detect disconnected clients
  - Visibility state tracking
  - Client count management
  - Message broadcasting
  - Automatic reconnection after sleep/wake

- **PortWrapper** (Client side) - Wraps SharedWorker connections with:
  - Automatic visibility detection
  - Automatic ping responses
  - Clean disconnect handling

[View Library Documentation](./packages/shared-worker-utils/README.md)

### Example Demo

A real-world example demonstrating:
- Single WebSocket connection shared across browser tabs
- Automatic connection management based on client visibility
- Real-time stock price updates
- Resource optimization (pauses when no tabs are visible)

[View Example Documentation](./packages/example/README.md)

## Key Features

### Smart Resource Management
- Automatically pauses expensive operations when all tabs are hidden
- Resumes when any tab becomes visible
- Closes connections when last tab closes

### Robust Connection Handling
- Detects and removes stale clients via ping/pong heartbeat
- Handles computer sleep/wake cycles gracefully
- Automatic reconnection logic

### Developer Friendly
- Full TypeScript support
- Comprehensive test coverage (vitest)
- Simple, intuitive API
- Callback-based logging

## Use Cases

- **Shared WebSocket Connections**: Reduce server load by sharing one connection across tabs
- **Real-time Updates**: Push data to multiple tabs efficiently
- **Resource Optimization**: Pause expensive operations when users aren't watching
- **Synchronized State**: Keep multiple tabs in sync with minimal overhead

## Browser Support

SharedWorker is supported in:
- Chrome/Edge 4+
- Firefox 29+
- Safari 16+

Not supported in:
- Internet Explorer
- Mobile Safari (iOS)
- Chrome on iOS

## Development

### Workspace Structure

```
shared-worker-simple/
├── packages/
│   ├── shared-worker-utils/     # Library package
│   │   ├── src/
│   │   │   ├── port-manager.ts
│   │   │   ├── port-wrapper.ts
│   │   │   └── types.ts
│   │   └── tests/
│   └── example/                 # Demo package
│       ├── server.js            # WebSocket server
│       ├── src/
│       │   ├── main.ts          # Client code
│       │   ├── shared-worker.ts # SharedWorker code
│       │   └── style.css
│       └── index.html
├── pnpm-workspace.yaml
└── package.json
```

### Commands

- `pnpm dev` - Start example dev server
- `pnpm server` - Start WebSocket server
- `pnpm test` - Run library tests
- `pnpm build` - Build library and example

## Contributing

This is a demonstration project. Feel free to fork and adapt for your own use cases!

## License

MIT
