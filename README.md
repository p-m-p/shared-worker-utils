# shared-worker-utils

<div align="center">

[![npm version](https://img.shields.io/npm/v/shared-worker-utils.svg)](https://www.npmjs.com/package/shared-worker-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./packages/shared-worker-utils/LICENSE)

A lightweight TypeScript library for managing SharedWorker port connections with automatic heartbeat, visibility tracking, and resource optimization.

</div>

## Features

- 🔄 **Automatic Heartbeat** - Ping/pong mechanism to detect and remove stale clients
- 👁️ **Visibility Tracking** - Automatically tracks which tabs are visible/hidden
- 🎯 **Type-Safe** - Full TypeScript support with generic message types
- 📡 **Message Filtering** - Internal messages automatically filtered from application code
- 💤 **Sleep/Wake Handling** - Gracefully handles computer sleep/wake cycles
- 🧪 **Well Tested** - Comprehensive test coverage with 26 unit tests
- 📦 **Tiny** - Only 3.98 kB (1.30 kB gzipped)

## Installation

```bash
npm install shared-worker-utils
# or
pnpm add shared-worker-utils
# or
yarn add shared-worker-utils
```

## Quick Start

### SharedWorker Side

```typescript
import { PortManager } from 'shared-worker-utils';

// Define your message types for type safety
type ClientMessage = { type: 'request'; id: string };

const portManager = new PortManager<ClientMessage>({
  onActiveCountChange: (activeCount, totalCount) => {
    console.log(`Active clients: ${activeCount}/${totalCount}`);
  },
  onMessage: (port, message) => {
    // Handle application messages from clients
    console.log('Received:', message);
  },
});

// Handle new connections
self.onconnect = (event) => {
  portManager.handleConnect(event.ports[0]);
};
```

### Client Side

```typescript
import { SharedWorkerClient } from 'shared-worker-utils';

type WorkerMessage = { type: 'update'; data: string };

const worker = new SharedWorker(
  new URL('./my-worker.ts', import.meta.url),
  { type: 'module' }
);

const client = new SharedWorkerClient<WorkerMessage>(worker, {
  onMessage: (message) => {
    // message is typed as WorkerMessage
    console.log('Update:', message.data);
  },
});

// Send messages
client.send({ type: 'request', id: '123' });
```

## What's Included

### PortManager

Manages MessagePort connections on the SharedWorker side with:
- Automatic ping/pong heartbeat to detect disconnected clients
- Visibility state tracking for all connected tabs
- Client count management (total and active)
- Message broadcasting to all clients
- Automatic reconnection after computer sleep/wake

### SharedWorkerClient

Wraps SharedWorker connections on the client side with:
- Automatic visibility detection using Page Visibility API
- Automatic ping/pong responses
- Clean disconnect handling on page unload
- Internal message filtering

## Live Demo

Check out the [example application](./packages/example) showing real-time stock prices shared across browser tabs via a single WebSocket connection.

**Run the demo:**

```bash
git clone https://github.com/p-m-p/shared-worker-utils.git
cd shared-worker-utils
pnpm install
pnpm server  # Terminal 1
pnpm dev     # Terminal 2
```

Then open http://localhost:5173 in multiple tabs!

## Use Cases

- **Shared WebSocket Connections** - Reduce server load by sharing one connection across all tabs
- **Real-time Updates** - Push data to multiple tabs efficiently with a single source
- **Resource Optimization** - Automatically pause expensive operations when all tabs are hidden
- **Synchronized State** - Keep multiple tabs in sync with minimal overhead
- **Background Processing** - Offload work to a SharedWorker while maintaining connection to all tabs

## API Documentation

### PortManager<TMessage>

**Constructor Options:**
- `pingInterval?: number` - Interval between ping messages (default: 10000ms)
- `pingTimeout?: number` - Max time to wait for pong response (default: 5000ms)
- `onActiveCountChange?: (activeCount: number, totalCount: number) => void` - Callback when client counts change
- `onMessage?: (port: MessagePort, message: TMessage) => void` - Callback for non-internal messages
- `onLog?: (message: string, ...args: unknown[]) => void` - Callback for internal logging

**Methods:**
- `handleConnect(port: MessagePort): void` - Handle a new port connection
- `broadcast(message: unknown): void` - Broadcast a message to all clients
- `getActiveCount(): number` - Get count of visible clients
- `getTotalCount(): number` - Get count of all connected clients
- `destroy(): void` - Clean up resources

### SharedWorkerClient<TMessage>

**Constructor Options:**
- `onMessage: (message: TMessage) => void` - Callback for non-internal messages (required)
- `onLog?: (message: string, ...args: unknown[]) => void` - Callback for internal logging

**Methods:**
- `send(message: unknown): void` - Send a message to the SharedWorker
- `disconnect(): void` - Disconnect from the SharedWorker
- `isVisible(): boolean` - Check if the tab is currently visible

[Full API Documentation →](./packages/shared-worker-utils/README.md)

## Browser Support

SharedWorker is supported in:
- ✅ Chrome/Edge 4+
- ✅ Firefox 29+
- ✅ Safari 16+

Not supported in:
- ❌ Internet Explorer
- ❌ Mobile Safari (iOS)
- ❌ Chrome on iOS (uses Safari engine)

## Development

This is a monorepo containing the library and example application.

**Commands:**
```bash
pnpm install     # Install dependencies
pnpm test        # Run tests
pnpm build       # Build library and example
pnpm lint        # Lint all packages
pnpm dev         # Start example dev server
pnpm server      # Start WebSocket server for example
```

**Project Structure:**
```
packages/
├── shared-worker-utils/  # NPM package
│   ├── src/             # Source files
│   ├── tests/           # Unit tests
│   └── dist/            # Built output
└── example/             # Demo application
    ├── src/             # Example source
    └── server.js        # WebSocket server
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Phil Parsons

See [LICENSE](./packages/shared-worker-utils/LICENSE) for details.
