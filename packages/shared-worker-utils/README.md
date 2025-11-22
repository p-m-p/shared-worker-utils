# shared-worker-utils

Utilities for managing SharedWorker port connections with ping/pong heartbeat and visibility tracking.

## Features

- **PortManager**: Manages MessagePort connections in a SharedWorker
  - Automatic ping/pong heartbeat to detect stale connections
  - Stale client tracking with optional auto-removal timeout
  - Manual stale client cleanup methods
  - Visibility state tracking for all connected clients
  - Automatic reconnection when stale clients send messages
  - Message broadcasting to connected clients only
  - Structured logging support

- **SharedWorkerClient**: Wraps a SharedWorker connection on the client side
  - Automatic visibility change detection
  - Automatic ping/pong responses
  - Clean disconnect on page unload
  - Structured logging support

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
} from 'https://esm.sh/shared-worker-utils@1.0.0'
```

**Example with SharedWorker:**

```typescript
// my-worker.js
import { PortManager } from 'https://esm.sh/shared-worker-utils@1'

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
  import { SharedWorkerClient } from 'https://esm.sh/shared-worker-utils@1'

  const worker = new SharedWorker('./my-worker.js', { type: 'module' })
  const client = new SharedWorkerClient(worker, {
    onMessage: (message) => console.log('Received:', message),
  })
</script>
```

## Usage

### SharedWorker Side

```typescript
import { PortManager } from 'shared-worker-utils'

// Define your application message types
type ClientMessage =
  | { type: 'request-data'; id: string }
  | { type: 'custom-action'; payload: unknown }

const portManager = new PortManager<ClientMessage>({
  pingInterval: 10000, // Send ping every 10 seconds
  pingTimeout: 5000, // Expect pong within 5 seconds of ping
  // staleClientTimeout: 60000, // Optional: Auto-remove stale clients after 1 minute
  onActiveCountChange: (activeCount, totalCount) => {
    console.log(`Active clients: ${activeCount}/${totalCount}`)
    // Manage your resources based on active clients
    if (activeCount === 0) {
      // Pause expensive operations
    } else if (activeCount > 0) {
      // Resume operations
    }
  },
  onMessage: (port, message) => {
    // message is typed as ClientMessage
    if (message.type === 'request-data') {
      console.log('Data requested:', message.id)
    }
  },
  onLog: (logEntry) => {
    // Structured logging with level, message, and optional context
    const contextStr = logEntry.context
      ? ` ${JSON.stringify(logEntry.context)}`
      : ''
    console.log(
      `[${logEntry.level.toUpperCase()}] ${logEntry.message}${contextStr}`
    )
  },
})

// Handle new connections
onconnect = (event) => {
  const port = event.ports[0]
  portManager.handleConnect(port)

  // Optionally send initial data to the client
  port.postMessage({ type: 'welcome', data: 'Hello!' })
}

// Broadcast to all connected clients (excludes stale clients)
portManager.broadcast({ type: 'update', data: someData })

// Get client counts
const totalClients = portManager.getTotalCount() // Connected clients only
const activeClients = portManager.getActiveCount() // Connected + visible clients
const staleClients = portManager.getStaleClientCount() // Stale clients

// Manually remove stale clients (useful if not using staleClientTimeout)
if (staleClients > 5) {
  const removed = portManager.removeStaleClients()
  console.log(`Removed ${removed} stale clients`)
}
```

### Client Side

```typescript
import { SharedWorkerClient } from 'shared-worker-utils'

// Define message types from SharedWorker
type WorkerMessage =
  | { type: 'update'; data: string }
  | { type: 'welcome'; data: string }

const worker = new SharedWorker(new URL('./my-worker.ts', import.meta.url), {
  type: 'module',
})

const client = new SharedWorkerClient<WorkerMessage>(worker, {
  onMessage: (message) => {
    // message is typed as WorkerMessage
    switch (message.type) {
      case 'update':
        console.log('Update:', message.data)
        break
      case 'welcome':
        console.log('Welcome message:', message.data)
        break
    }
  },
  onLog: (logEntry) => {
    // Structured logging with level, message, and optional context
    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}`)
  },
})

// Send custom messages
client.send({ type: 'custom', data: 'hello' })

// Check visibility
if (client.getIsVisible()) {
  // Tab is visible
}

// Manually disconnect
client.disconnect()
```

## API

### PortManager

`PortManager<TMessage = unknown>` - Generic type parameter for application messages from clients.

#### Constructor Options

```typescript
interface PortManagerOptions<TMessage = unknown> {
  /** Interval between ping messages in milliseconds (default: 10000) */
  pingInterval?: number

  /** Maximum time to wait for pong response after ping in milliseconds (default: 5000) */
  pingTimeout?: number

  /** Auto-remove stale clients after this many milliseconds (default: undefined - no auto-removal) */
  staleClientTimeout?: number

  /** Callback when active or total client count changes */
  onActiveCountChange?: (activeCount: number, totalCount: number) => void

  /** Callback for messages from clients */
  onMessage?: (port: MessagePort, message: TMessage) => void

  /** Callback for internal logging with structured log entries */
  onLog?: (logEntry: LogEntry) => void
}

/**
 * Structured log entry
 */
interface LogEntry {
  /** The log message */
  message: string
  /** The log level: 'info' | 'debug' | 'warn' | 'error' */
  level: LogLevel
  /** Optional context data */
  context?: Record<string, unknown>
}
```

#### Methods

- `handleConnect(port: MessagePort): void` - Handle a new port connection
- `broadcast(message: unknown): void` - Broadcast a message to all connected clients (excludes stale clients)
- `getActiveCount(): number` - Get the number of active (visible and connected) clients
- `getTotalCount(): number` - Get the total number of connected clients (excludes stale clients)
- `getStaleClientCount(): number` - Get the number of stale clients
- `removeStaleClients(): number` - Manually remove all stale clients and return the count of removed clients
- `destroy(): void` - Clean up resources (stop ping interval and remove all clients)

### SharedWorkerClient

`SharedWorkerClient<TMessage = unknown>` - Generic type parameter for application messages from SharedWorker.

#### Constructor Options

```typescript
interface SharedWorkerClientOptions<TMessage = unknown> {
  /** Callback for messages from SharedWorker */
  onMessage: (message: TMessage) => void

  /** Callback for internal logging with structured log entries */
  onLog?: (logEntry: LogEntry) => void
}
```

#### Methods

- `send(message: unknown): void` - Send a message to the SharedWorker
- `disconnect(): void` - Disconnect from the SharedWorker
- `getIsVisible(): boolean` - Check if the tab is currently visible

## Structured Logging

The library uses structured logging to provide better integration with logging systems and improved queryability. The `onLog` callback receives a `LogEntry` object with the following structure:

```typescript
interface LogEntry {
  message: string // The log message (e.g., "[PortManager] New client connected")
  level: 'info' | 'debug' | 'warn' | 'error' // The log level
  context?: Record<string, unknown> // Optional contextual data
}
```

### Log Levels

- **`info`**: Important state changes (connections, disconnections, initialization)
- **`debug`**: Routine operations (ping/pong messages, count updates)
- **`warn`**: Warnings (not currently used)
- **`error`**: Errors (not currently used)

### Example Usage

```typescript
const portManager = new PortManager({
  onLog: (logEntry) => {
    // Send to a logging service
    logger.log({
      level: logEntry.level,
      message: logEntry.message,
      ...logEntry.context,
      timestamp: new Date().toISOString(),
    })

    // Or format for console
    const contextStr = logEntry.context
      ? ` ${JSON.stringify(logEntry.context)}`
      : ''
    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}${contextStr}`)
  },
})
```

### Example Log Entries

```typescript
// Connection event with context
{
  message: "[PortManager] New client connected",
  level: "info",
  context: { totalClients: 3 }
}

// Visibility change with context
{
  message: "[PortManager] Client visibility changed",
  level: "info",
  context: { visible: false }
}

// Debug message
{
  message: "[PortManager] Sending ping to client",
  level: "debug"
}
```

## How It Works

### Ping/Pong Heartbeat

The PortManager sends ping messages at the specified `pingInterval`. Each client must respond with a pong within `pingTimeout` milliseconds. If a client fails to respond, it's marked as stale.

The staleness check is: `now - lastSeen > pingInterval + pingTimeout`

For example, with `pingInterval: 10000` and `pingTimeout: 5000`:

- Ping sent every 10 seconds
- Client must respond within 5 seconds
- Client marked as stale if no response for 15 seconds total

### Stale Client Management

When a client is marked as stale, it's not immediately removed. Instead:

1. **Status Tracking**: The client's status changes from `'connected'` to `'stale'`
2. **Excluded from Operations**: Stale clients are excluded from:
   - `getTotalCount()` - only counts connected clients
   - `getActiveCount()` - only counts connected, visible clients
   - `broadcast()` - messages only sent to connected clients
3. **Automatic Reconnection**: If a stale client sends ANY message (including pong), it's automatically restored to `'connected'` status
4. **Optional Auto-Removal**: If `staleClientTimeout` is set, stale clients are automatically removed after the timeout period
5. **Manual Cleanup**: Use `removeStaleClients()` to manually remove all stale clients at any time

#### Example with Auto-Removal

```typescript
const portManager = new PortManager({
  pingInterval: 10_000, // 10 seconds
  pingTimeout: 5000, // 5 seconds
  staleClientTimeout: 60_000, // 1 minute
})

// Timeline for an unresponsive client:
// t=0s: Client connects
// t=10s: Ping sent
// t=15s: No pong received, client marked as stale
// t=75s: 60 seconds after becoming stale, client is auto-removed
```

#### Example with Manual Cleanup

```typescript
const portManager = new PortManager({
  pingInterval: 10_000,
  pingTimeout: 5000,
  // No staleClientTimeout - stale clients persist until manually removed
})

// Check for stale clients
if (portManager.getStaleClientCount() > 0) {
  console.log(`Found ${portManager.getStaleClientCount()} stale clients`)

  // Manually remove them
  const removed = portManager.removeStaleClients()
  console.log(`Removed ${removed} stale clients`)
}
```

#### Why Track Instead of Remove?

This approach provides several benefits:

1. **Reconnection Support**: Clients that temporarily lose connection (e.g., laptop sleep, network blip) can automatically reconnect
2. **Flexible Cleanup**: Choose between automatic timeout-based removal or manual cleanup based on your needs
3. **Visibility**: Track stale clients separately to monitor connection health
4. **No False Positives**: Clients aren't immediately removed due to temporary network issues

### Visibility Tracking

SharedWorkerClient uses the Page Visibility API to track when tabs are hidden/visible. This information is automatically sent to the SharedWorker, allowing you to:

- Pause expensive operations when no tabs are visible
- Resume when a tab becomes visible
- Get accurate counts of active (visible) clients

### Automatic Reconnection

If a client temporarily loses connection (e.g., laptop sleep, network interruption):

1. PortManager's ping/pong mechanism will mark the client as stale after `pingInterval + pingTimeout`
2. The client remains in memory but is excluded from broadcasts and counts
3. When the client reconnects and sends ANY message (including pong), it's automatically restored to connected status
4. The stale timestamp is cleared, preventing auto-removal
5. Everything resumes normally without creating a new connection

## Example

See the [example package](../example) for a complete demo showing:

- SharedWorker managing a WebSocket connection
- Multiple tabs sharing one connection
- Connection paused when all tabs hidden
- Real-time stock price updates

## License

MIT
