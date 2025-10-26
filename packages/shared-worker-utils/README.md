# shared-worker-utils

Utilities for managing SharedWorker port connections with ping/pong heartbeat and visibility tracking.

## Features

- **PortManager**: Manages MessagePort connections in a SharedWorker
  - Automatic ping/pong heartbeat to detect stale connections
  - Visibility state tracking for all connected clients
  - Automatic reconnection after sleep/wake cycles
  - Message broadcasting to all clients

- **PortWrapper**: Wraps a SharedWorker connection on the client side
  - Automatic visibility change detection
  - Automatic ping/pong responses
  - Clean disconnect on page unload

## Installation

```bash
npm install shared-worker-utils
# or
pnpm add shared-worker-utils
# or
yarn add shared-worker-utils
```

## Usage

### SharedWorker Side

```typescript
import { PortManager } from 'shared-worker-utils';

const portManager = new PortManager({
  pingInterval: 10000,  // Send ping every 10 seconds
  pingTimeout: 5000,    // Expect pong within 5 seconds of ping
  onActiveCountChange: (activeCount, totalCount) => {
    console.log(`Active clients: ${activeCount}/${totalCount}`);
    // Manage your resources based on active clients
    if (activeCount === 0) {
      // Pause expensive operations
    } else if (activeCount > 0) {
      // Resume operations
    }
  },
  onMessage: (port, message) => {
    // Handle application messages from clients (internal messages filtered out)
    console.log('Application message:', message);
  },
  onLog: (message, ...args) => {
    console.log(message, ...args);
  },
});

// Handle new connections
onconnect = (event) => {
  const port = event.ports[0];
  portManager.handleConnect(port);

  // Optionally send initial data to the client
  port.postMessage({ type: 'welcome', data: 'Hello!' });
};

// Broadcast to all clients
portManager.broadcast({ type: 'update', data: someData });

// Get client counts
const totalClients = portManager.getTotalCount();
const activeClients = portManager.getActiveCount();
```

### Client Side

```typescript
import { PortWrapper } from 'shared-worker-utils';

const worker = new SharedWorker(
  new URL('./my-worker.ts', import.meta.url),
  { type: 'module' }
);

const wrapper = new PortWrapper(worker, {
  onMessage: (message) => {
    // Handle application messages from SharedWorker
    // Internal messages (ping, pong, client-count, visibility-change, disconnect) are filtered out
    switch (message.type) {
      case 'update':
        console.log('Update:', message.data);
        break;
      case 'welcome':
        console.log('Welcome message:', message.data);
        break;
    }
  },
  onLog: (message, ...args) => {
    console.log(message, ...args);
  },
});

// Send custom messages
wrapper.send({ type: 'custom', data: 'hello' });

// Check visibility
if (wrapper.isVisible()) {
  // Tab is visible
}

// Manually disconnect
wrapper.disconnect();
```

## API

### PortManager

#### Constructor Options

```typescript
interface PortManagerOptions {
  /** Interval between ping messages in milliseconds (default: 10000) */
  pingInterval?: number;

  /** Maximum time to wait for pong response after ping in milliseconds (default: 5000) */
  pingTimeout?: number;

  /** Callback when active or total client count changes */
  onActiveCountChange?: (activeCount: number, totalCount: number) => void;

  /** Callback for non-internal messages from clients */
  onMessage?: (port: MessagePort, message: any) => void;

  /** Callback for internal logging */
  onLog?: (message: string, ...args: any[]) => void;
}
```

#### Methods

- `handleConnect(port: MessagePort): void` - Handle a new port connection
- `broadcast(message: any): void` - Broadcast a message to all connected clients
- `getActiveCount(): number` - Get the number of active (visible) clients
- `getTotalCount(): number` - Get the total number of connected clients
- `destroy(): void` - Clean up resources (stop ping interval)

#### Internal Messages Handled

PortManager automatically handles these message types:
- `visibility-change` - Client visibility state changed
- `disconnect` - Client is disconnecting
- `pong` - Response to ping heartbeat

#### Automatic Internal Messages

These messages are sent by PortManager but are filtered out by PortWrapper and not passed to application code:
- `ping` - Heartbeat message sent at `pingInterval`
- `client-count` - Sent when client counts change: `{ type: 'client-count', total: number, active: number }`

**Note**: If your application needs client count information, use the `onActiveCountChange` callback in PortManager to send a custom application message.

### PortWrapper

#### Constructor Options

```typescript
interface PortWrapperOptions {
  /** Callback for non-internal messages from SharedWorker */
  onMessage: (message: any) => void;

  /** Callback for internal logging */
  onLog?: (message: string, ...args: any[]) => void;
}
```

#### Methods

- `send(message: any): void` - Send a message to the SharedWorker
- `disconnect(): void` - Disconnect from the SharedWorker
- `isVisible(): boolean` - Check if the tab is currently visible

#### Automatic Behavior

PortWrapper automatically:
- Responds to `ping` messages with `pong`
- Sends `visibility-change` messages when tab visibility changes
- Sends `disconnect` message on `beforeunload`
- Filters out internal messages (ping, pong, client-count, visibility-change, disconnect) from `onMessage` callback

## How It Works

### Ping/Pong Heartbeat

The PortManager sends ping messages at the specified `pingInterval`. Each client must respond with a pong within `pingTimeout` milliseconds. If a client fails to respond, it's considered stale and removed.

The staleness check is: `now - lastPong > pingInterval + pingTimeout`

For example, with `pingInterval: 10000` and `pingTimeout: 5000`:
- Ping sent every 10 seconds
- Client must respond within 5 seconds
- Client removed if no pong for 15 seconds total

### Visibility Tracking

PortWrapper uses the Page Visibility API to track when tabs are hidden/visible. This information is automatically sent to the SharedWorker, allowing you to:
- Pause expensive operations when no tabs are visible
- Resume when a tab becomes visible
- Get accurate counts of active (visible) clients

### Sleep/Wake Handling

When a computer sleeps:
1. PortManager's ping/pong may timeout and remove "stale" clients
2. When computer wakes, clients send messages (pong, visibility-change, etc.)
3. PortManager detects missing client and re-adds it automatically
4. Everything resumes normally

## Example

See the [example package](../example) for a complete demo showing:
- SharedWorker managing a WebSocket connection
- Multiple tabs sharing one connection
- Connection paused when all tabs hidden
- Real-time stock price updates

## License

MIT
