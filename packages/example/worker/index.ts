/**
 * Cloudflare Worker with Durable Objects for WebSocket stock price broadcasting
 * This replaces the Node.js server.js for Cloudflare deployment
 */

export interface Environment {
  STOCK_WEBSOCKET: DurableObjectNamespace
}

// Stock symbols to broadcast
const STOCKS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD']

// Initial stock prices
const BASE_PRICES: Record<string, number> = {
  AAPL: 175.5,
  GOOGL: 142.3,
  MSFT: 378.9,
  AMZN: 145.2,
  TSLA: 242.8,
  META: 485.6,
  NVDA: 875.4,
  AMD: 165.3,
}

// Generate random stock price
function generateStockPrice(symbol: string, basePrice: number) {
  const change = (Math.random() - 0.5) * 10 // Random change between -5 and +5
  const price = basePrice + change
  const percentChange = ((change / basePrice) * 100).toFixed(2)
  return {
    symbol,
    price: price.toFixed(2),
    change: change.toFixed(2),
    percentChange: percentChange,
    timestamp: new Date().toISOString(),
  }
}

// Main worker - routes WebSocket upgrade requests to Durable Objects
export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade request', { status: 426 })
    }

    // Get Durable Object instance (use a single instance for all connections)
    const id = environment.STOCK_WEBSOCKET.idFromName('stock-broadcast')
    const stub = environment.STOCK_WEBSOCKET.get(id)

    // Forward the request to the Durable Object
    return stub.fetch(request)
  },
}

// Durable Object to manage WebSocket connections and broadcasting
export class StockWebSocket implements DurableObject {
  private sessions: Set<WebSocket>
  private broadcastInterval: number | null
  private heartbeatInterval: number | null

  constructor(_state: DurableObjectState, _environment: Environment) {
    this.sessions = new Set()
    this.broadcastInterval = null
    this.heartbeatInterval = null
  }

  async fetch(_request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Accept the WebSocket connection
    this.handleSession(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  handleSession(ws: WebSocket) {
    // Accept the connection
    ws.accept()

    // Add to sessions set
    this.sessions.add(ws)

    console.log(`New client connected. Active clients: ${this.sessions.size}`)

    // Start broadcast interval if this is the first client
    if (this.sessions.size === 1) {
      this.startBroadcasting()
      this.startHeartbeat()
    }

    // Send initial stock data
    const initialData = STOCKS.map((symbol) =>
      generateStockPrice(symbol, BASE_PRICES[symbol])
    )

    ws.send(
      JSON.stringify({
        type: 'stock-update',
        data: initialData,
      })
    )

    // Handle messages from client
    ws.addEventListener('message', (event) => {
      // Echo pong messages for heartbeat
      if (event.data === 'ping') {
        ws.send('pong')
      }
    })

    // Handle client disconnect
    ws.addEventListener('close', () => {
      this.sessions.delete(ws)
      console.log(`Client disconnected. Active clients: ${this.sessions.size}`)

      // Stop broadcasting if no clients remain
      if (this.sessions.size === 0) {
        this.stopBroadcasting()
        this.stopHeartbeat()
      }
    })

    // Handle errors
    ws.addEventListener('error', (event) => {
      console.error('WebSocket error:', event)
      this.sessions.delete(ws)

      // Stop broadcasting if no clients remain
      if (this.sessions.size === 0) {
        this.stopBroadcasting()
        this.stopHeartbeat()
      }
    })
  }

  startBroadcasting() {
    if (this.broadcastInterval !== null) {
      return
    }

    console.log('Starting stock price broadcasting')

    // Broadcast stock prices every second
    this.broadcastInterval = setInterval(() => {
      if (this.sessions.size === 0) {
        return
      }

      const stockData = STOCKS.map((symbol) =>
        generateStockPrice(symbol, BASE_PRICES[symbol])
      )

      const message = JSON.stringify({
        type: 'stock-update',
        data: stockData,
      })

      // Broadcast to all connected clients
      for (const ws of this.sessions) {
        try {
          ws.send(message)
        } catch (error) {
          console.error('Error sending to client:', error)
          this.sessions.delete(ws)
        }
      }
    }, 1000) as unknown as number
  }

  stopBroadcasting() {
    if (this.broadcastInterval !== null) {
      console.log('Stopping stock price broadcasting')
      clearInterval(this.broadcastInterval)
      this.broadcastInterval = null
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval !== null) {
      return
    }

    console.log('Starting heartbeat')

    // Check connection health every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.sessions) {
        try {
          // Send ping
          ws.send('ping')
        } catch (error) {
          console.error('Error during heartbeat:', error)
          this.sessions.delete(ws)
        }
      }

      // Stop if no clients remain
      if (this.sessions.size === 0) {
        this.stopBroadcasting()
        this.stopHeartbeat()
      }
    }, 30_000) as unknown as number
  }

  stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      console.log('Stopping heartbeat')
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}
