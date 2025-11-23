<div align="center">

<img src="./logo.svg" alt="shared-worker-utils logo" width="200"/>

# shared-worker-utils

[![npm version](https://img.shields.io/npm/v/shared-worker-utils.svg)](https://www.npmjs.com/package/shared-worker-utils)
[![Build](https://img.shields.io/github/actions/workflow/status/p-m-p/shared-worker-utils/release.yml?label=Build)](https://github.com/p-m-p/shared-worker-utils/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A lightweight TypeScript library for managing SharedWorker port connections with automatic heartbeat, visibility tracking, and resource optimization.

</div>

## Features

- 🔄 **Automatic Heartbeat** - Ping/pong mechanism to detect stale clients
- 🗑️ **Stale Client Management** - Track stale clients with optional auto-removal or manual cleanup
- 👁️ **Visibility Tracking** - Automatically tracks which tabs are visible/hidden
- 🎯 **Type-Safe** - Full TypeScript support with generic message types
- 🔌 **Automatic Reconnection** - Gracefully restores stale clients when they send messages
- 📦 **Tiny** - Under 5 kB (less than 2 kB gzipped)

## Installation

### Via Package Manager

```bash
npm install shared-worker-utils
# or
pnpm add shared-worker-utils
# or
yarn add shared-worker-utils
```

### Via CDN (ESM)

You can also import directly from a CDN without a build step:

```typescript
// Import from esm.sh CDN
import {
  PortManager,
  SharedWorkerClient,
} from 'https://esm.sh/shared-worker-utils'

// Or with a specific version
import {
  PortManager,
  SharedWorkerClient,
} from 'https://esm.sh/shared-worker-utils'
```

**Example with SharedWorker:**

```typescript
// my-worker.js
import { PortManager } from 'https://esm.sh/shared-worker-utils'

const portManager = new PortManager({
  onActiveCountChange: (active, total) => {
    console.log(`Active: ${active}/${total}`)
  },
})

self.onconnect = (event) => {
  portManager.handleConnect(event.ports[0])
}
```

```html
<!-- index.html -->
<script type="module">
  import { SharedWorkerClient } from 'https://esm.sh/shared-worker-utils'

  const worker = new SharedWorker('./my-worker.js', { type: 'module' })
  const client = new SharedWorkerClient(worker, {
    onMessage: (message) => console.log('Received:', message),
  })
</script>
```

## Quick Start

### SharedWorker Side

```typescript
import { PortManager } from 'shared-worker-utils'

// Define your message types for type safety
type ClientMessage = { type: 'request'; id: string }

const portManager = new PortManager<ClientMessage>({
  onActiveCountChange: (activeCount, totalCount) => {
    console.log(`Active clients: ${activeCount}/${totalCount}`)
  },
  onMessage: (port, message) => {
    // Handle application messages from clients
    console.log('Received:', message)
  },
})

// Handle new connections
self.onconnect = (event) => {
  portManager.handleConnect(event.ports[0])
}
```

### Client Side

```typescript
import { SharedWorkerClient } from 'shared-worker-utils'

type WorkerMessage = { type: 'update'; data: string }

const worker = new SharedWorker(new URL('./my-worker.ts', import.meta.url), {
  type: 'module',
})

const client = new SharedWorkerClient<WorkerMessage>(worker, {
  onMessage: (message) => {
    // message is typed as WorkerMessage
    console.log('Update:', message.data)
  },
})

// Send messages
client.send({ type: 'request', id: '123' })
```

## What's Included

### PortManager

Manages MessagePort connections on the SharedWorker side with:

- Automatic ping/pong heartbeat to detect stale clients
- Stale client tracking with optional auto-removal timeout
- Manual stale client cleanup methods
- Visibility state tracking for all connected tabs
- Client count management (total, active, and stale)
- Message broadcasting to connected clients only
- Automatic reconnection when stale clients send messages

### SharedWorkerClient

Wraps SharedWorker connections on the client side with:

- Automatic visibility detection using Page Visibility API
- Automatic ping/pong responses
- Clean disconnect handling on page unload

## Live Demo

Check out the [example application](./packages/example) showing real-time stock prices shared across browser tabs via a single WebSocket connection.

**[View the live demo →](https://philparsons.co.uk/shared-worker-utils/)**

**Run locally:**

```bash
git clone https://github.com/p-m-p/shared-worker-utils.git
cd shared-worker-utils
pnpm install
cd packages/example
pnpm worker:dev  # Terminal 1
pnpm dev         # Terminal 2
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
- `staleClientTimeout?: number` - Auto-remove stale clients after this duration (default: undefined - no auto-removal)
- `onActiveCountChange?: (activeCount: number, totalCount: number) => void` - Callback when client counts change
- `onMessage?: (port: MessagePort, message: TMessage) => void` - Callback for messages from clients
- `onLog?: (logEntry: LogEntry) => void` - Callback for internal logging with structured log entries
  - `LogEntry` has properties: `message: string`, `level: LogLevel`, `context?: Record<string, unknown>`
  - `LogLevel` is one of: `'info'`, `'debug'`, `'warn'`, `'error'`

**Methods:**

- `handleConnect(port: MessagePort): void` - Handle a new port connection
- `broadcast(message: unknown): void` - Broadcast a message to all connected clients (excludes stale)
- `getActiveCount(): number` - Get count of active (visible and connected) clients
- `getTotalCount(): number` - Get count of connected clients (excludes stale)
- `getStaleCount(): number` - Get count of stale clients
- `removeStaleClients(): number` - Manually remove all stale clients and return count removed
- `destroy(): void` - Clean up resources

### SharedWorkerClient<TMessage>

**Constructor Options:**

- `onMessage: (message: TMessage) => void` - Callback for messages from SharedWorker (required)
- `onLog?: (logEntry: LogEntry) => void` - Callback for internal logging with structured log entries

**Methods:**

- `send(message: unknown): void` - Send a message to the SharedWorker
- `disconnect(): void` - Disconnect from the SharedWorker
- `isVisible(): boolean` - Check if the tab is currently visible

[Full API Documentation →](./packages/shared-worker-utils/README.md)

## Browser Support

See [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker#browser_compatibility) for current SharedWorker support across browsers.

## Development

This is a monorepo containing the library and example application.

**Commands:**

```bash
pnpm install     # Install dependencies
pnpm test        # Run tests
pnpm build       # Build library and example
pnpm lint        # Lint all packages
pnpm dev         # Start example dev server
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
    └── worker/          # Cloudflare Worker
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Phil Parsons

See [LICENSE](./LICENSE) for details.
