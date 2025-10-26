// SharedWorker to manage a single WebSocket connection across multiple tabs
import { PortManager } from 'shared-worker-utils'

// Declare SharedWorker global
declare const self: SharedWorkerGlobalScope

// Define message types for application messages
type AppMessage = never // No application messages from clients in this example

let socket: WebSocket | null = null
const WEBSOCKET_URL = 'ws://localhost:8080'
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
const RECONNECT_DELAY = 3000

function log(message: string, ...args: unknown[]) {
  console.log(message, ...args)
}

// Initialize PortManager with typed messages
const portManager = new PortManager<AppMessage>({
  pingInterval: 10_000,
  pingTimeout: 5000,
  onActiveCountChange: (activeCount, totalCount) => {
    // Manage WebSocket connection based on active clients
    if (activeCount === 0 && socket) {
      log('[WebSocket] No active clients, pausing WebSocket connection')
      disconnectWebSocket()
    } else if (activeCount > 0 && !socket) {
      log('[WebSocket] Active client detected, resuming WebSocket connection')
      connectWebSocket()
    }

    // Send client count as an application message (not the internal client-count message)
    portManager.broadcast({
      type: 'client-info',
      total: totalCount,
      active: activeCount,
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
    log('[WebSocket] Already connected or connecting')
    return
  }

  log('[WebSocket] Connecting to server...')
  socket = new WebSocket(WEBSOCKET_URL)

  socket.addEventListener('open', () => {
    log('[WebSocket] Connected')

    // Notify all connected clients
    portManager.broadcast({
      type: 'connection-status',
      status: 'connected',
    })
  })

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      log('[WebSocket] Received message:', data.type)

      // Broadcast message to all connected clients
      portManager.broadcast(data)
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error)
    }
  })

  socket.addEventListener('close', () => {
    log('[WebSocket] Disconnected')
    socket = null

    // Notify all connected clients
    portManager.broadcast({
      type: 'connection-status',
      status: 'disconnected',
    })

    // Reconnect if there are still active (visible) clients
    const activeCount = portManager.getActiveCount()

    if (activeCount > 0) {
      log(
        `[WebSocket] Reconnecting in ${RECONNECT_DELAY}ms... (${activeCount} active clients)`
      )
      reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY)
    } else {
      log('[WebSocket] No active clients, staying disconnected')
    }
  })

  socket.addEventListener('error', (error) => {
    console.error('[WebSocket] Error:', error)
  })
}

function disconnectWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  if (socket) {
    log('[WebSocket] Disconnecting')
    socket.close()
    socket = null
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

log('[SharedWorker] Initialized')
