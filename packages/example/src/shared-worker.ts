// SharedWorker to manage a single WebSocket connection across multiple tabs
import { PortManager, type LogEntry } from 'shared-worker-utils'

// Declare SharedWorker global
declare const self: SharedWorkerGlobalScope

// Define message types for application messages
type AppMessage = never // No application messages from clients in this example

let socket: WebSocket | undefined
// Use environment variable for WebSocket URL, default to wrangler dev server (localhost:8787)
const WEBSOCKET_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787'
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
const RECONNECT_DELAY = 3000

function log(logEntry: LogEntry) {
  const contextString = logEntry.context
    ? ` ${JSON.stringify(logEntry.context)}`
    : ''
  console.log(
    `[${logEntry.level.toUpperCase()}] ${logEntry.message}${contextString}`
  )
}

// Initialize PortManager with typed messages
const portManager = new PortManager<AppMessage>({
  pingInterval: 10_000,
  pingTimeout: 5000,
  onActiveCountChange: (activeCount, totalCount) => {
    // Manage WebSocket connection based on active clients
    if (activeCount === 0 && socket) {
      log({
        message: '[WebSocket] No active clients, pausing WebSocket connection',
        level: 'info',
      })
      disconnectWebSocket()
    } else if (activeCount > 0 && !socket) {
      log({
        message:
          '[WebSocket] Active client detected, resuming WebSocket connection',
        level: 'info',
      })
      connectWebSocket()
    }

    // Send client count as an application message (not the internal client-count message)
    portManager.broadcast({
      type: 'client-info',
      total: totalCount,
      active: activeCount,
      stale: portManager.getStaleCount(),
    })
  },
  onMessage: (_port, message) => {
    // Forward application messages to WebSocket server if needed
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  },
  onLog: log,
})

function connectWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN)
  ) {
    log({
      message: '[WebSocket] Already connected or connecting',
      level: 'info',
    })
    return
  }

  log({
    message: '[WebSocket] Connecting to server...',
    level: 'info',
  })
  socket = new WebSocket(WEBSOCKET_URL)

  socket.addEventListener('open', () => {
    log({
      message: '[WebSocket] Connected',
      level: 'info',
    })

    // Notify all connected clients
    portManager.broadcast({
      type: 'connection-status',
      status: 'connected',
    })
  })

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      log({
        message: '[WebSocket] Received message',
        level: 'debug',
        context: { type: data.type },
      })

      // Broadcast message to all connected clients
      portManager.broadcast(data)
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error)
    }
  })

  socket.addEventListener('close', () => {
    log({
      message: '[WebSocket] Disconnected',
      level: 'info',
    })
    socket = undefined

    // Notify all connected clients
    portManager.broadcast({
      type: 'connection-status',
      status: 'disconnected',
    })

    // Reconnect if there are still active (visible) clients
    const activeCount = portManager.getActiveCount()

    if (activeCount > 0) {
      log({
        message: '[WebSocket] Reconnecting...',
        level: 'info',
        context: { delayMs: RECONNECT_DELAY, activeClients: activeCount },
      })
      reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY)
    } else {
      log({
        message: '[WebSocket] No active clients, staying disconnected',
        level: 'info',
      })
    }
  })

  socket.addEventListener('error', (error) => {
    console.error('[WebSocket] Error:', error)
  })
}

function disconnectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = undefined
  }

  if (socket) {
    log({
      message: '[WebSocket] Disconnecting',
      level: 'info',
    })
    socket.close()
    socket = undefined
  }
}

// Handle new port connections
self.addEventListener('connect', (event: MessageEvent) => {
  const port = event.ports[0]

  // Let PortManager handle all port management
  portManager.handleConnect(port)

  // Send current connection status to the new client
  if (socket) {
    const status =
      socket.readyState === WebSocket.OPEN ? 'connected' : 'connecting'
    port.postMessage({
      type: 'connection-status',
      status,
    })
  } else {
    port.postMessage({
      type: 'connection-status',
      status: 'disconnected',
    })
  }
})

log({
  message: '[SharedWorker] Initialized',
  level: 'info',
})
