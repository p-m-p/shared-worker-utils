# SharedWorker WebSocket Demo

A demonstration of using `shared-worker-utils` to manage a single WebSocket connection shared across multiple browser tabs, featuring real-time stock price updates.

## What This Demo Shows

- **Single WebSocket Connection**: One WebSocket connection shared across all browser tabs via SharedWorker
- **Real-time Stock Updates**: Live stock price data broadcasting from the server
- **Smart Connection Management**:
  - Automatically connects when first active tab opens
  - Pauses WebSocket connection when all tabs are hidden/backgrounded
  - Resumes connection when any tab becomes visible again
  - Disconnects when last tab closes
- **Tab Visibility Optimization**: Automatically pauses table updates when tabs are backgrounded to save resources
- **Heartbeat Mechanism**: Automatic connection health monitoring with ping/pong
- **Stale Client Detection**: Removes disconnected clients automatically

## Running the Demo

### 1. Install Dependencies

From the workspace root:

```bash
pnpm install
```

### 2. Start the WebSocket Server

```bash
pnpm server
```

The server will start on `ws://localhost:8080` and begin broadcasting stock prices.

### 3. Start the Vite Dev Server

In a separate terminal:

```bash
pnpm dev
```

### 4. Open in Browser

Open the application in your browser (typically `http://localhost:5173`)

### 5. Test the Features

**Test SharedWorker Connection Sharing:**

1. Open the app in multiple tabs
2. Check browser DevTools console in each tab
3. Check the server terminal - only ONE client connection should be logged
4. Close tabs one by one - connection persists until the last tab is closed

**Test Visibility Optimization:**

1. Open the app in one tab
2. Open DevTools console to see update logs
3. Switch to another tab or minimize the window
4. The "Tab State" indicator changes to "Hidden"
5. Table updates pause (data still received, just not rendered)
6. Switch back - updates resume immediately

**Test Connection Pausing:**

1. Open the app in multiple tabs
2. Check server console - ONE WebSocket connection is active
3. Hide/background ALL tabs (switch to a different application)
4. Server console shows the connection is closed
5. Switch back to any tab
6. Server console shows a new connection is established
7. All tabs resume receiving updates

**Test Reconnection:**

1. Stop the server (`Ctrl+C`)
2. Notice the connection status changes to "Disconnected"
3. Restart the server
4. The SharedWorker automatically reconnects within 3 seconds

## Architecture

### Server (`server.js`)

- WebSocket server using the `ws` library
- Broadcasts mock stock price data every second
- Implements heartbeat/ping-pong mechanism (30-second interval)
- Tracks and logs connected clients
- Broadcasts to 8 stock symbols: AAPL, GOOGL, MSFT, AMZN, TSLA, META, NVDA, AMD

### SharedWorker (`src/shared-worker.ts`)

- Uses `PortManager` from `shared-worker-utils` to handle all port connections
- Manages a single WebSocket connection to the server
- Automatically connects/disconnects based on active client count
- Broadcasts server messages to all connected clients

### Client (`src/main.ts`)

- Uses `SharedWorkerClient` from `shared-worker-utils` to connect to SharedWorker
- Displays real-time stock prices in a table
- Pauses table updates when tab is not visible
- Shows connection status, client count, and visibility state

## How It Works

### Connection Flow

1. **First Tab Opens**
   - Client connects to SharedWorker via SharedWorkerClient
   - PortManager registers the client
   - SharedWorker creates WebSocket connection to server
   - Server sends initial stock data
   - Client displays data in table

2. **Additional Tabs Open**
   - Client connects to existing SharedWorker
   - PortManager adds new client to tracked ports
   - All clients share the same WebSocket connection

3. **Tab Becomes Hidden**
   - Page Visibility API detects tab is backgrounded
   - SharedWorkerClient sends visibility-change message
   - PortManager updates client count
   - Table updates are paused (data still received, just not rendered)

4. **All Tabs Hidden**
   - PortManager detects no active (visible) clients remain
   - WebSocket connection is closed to save resources
   - Server logs client disconnect

5. **Tab Becomes Visible Again**
   - SharedWorkerClient detects visibility change
   - PortManager updates client count
   - SharedWorker re-establishes WebSocket connection
   - All tabs receive updates again

6. **Last Tab Closes**
   - SharedWorkerClient sends disconnect message
   - PortManager removes client
   - WebSocket connection is closed

### Message Flow

```
Server → WebSocket → SharedWorker → PortManager → MessagePort → SharedWorkerClient → Client
```

All clients receive the same messages simultaneously from the SharedWorker.

## Key Concepts Demonstrated

- **SharedWorker API**: Creating and connecting to shared workers
- **WebSocket**: Real-time bidirectional communication
- **MessagePort**: Communication between clients and SharedWorker
- **Page Visibility API**: Detecting when tabs are backgrounded
- **Resource Optimization**: Pausing updates for hidden tabs and closing connections when no active clients
- **Heartbeat Pattern**: Keeping connections alive with ping/pong
- **Automatic Reconnection**: Handling sleep/wake cycles and network issues

## Browser Compatibility

See [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker#browser_compatibility) for current SharedWorker support across browsers.

## License

MIT
