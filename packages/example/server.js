import { WebSocketServer } from 'ws'

const PORT = 8080
const HEARTBEAT_INTERVAL = 30_000 // 30 seconds
const BROADCAST_INTERVAL = 1000 // 1 second

const wss = new WebSocketServer({ port: PORT })

// Track connected clients
const clients = new Set()

// Stock symbols to broadcast
const stocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD']

// Generate random stock price
function generateStockPrice(symbol, basePrice) {
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

// Initial stock prices
const basePrices = {
  AAPL: 175.5,
  GOOGL: 142.3,
  MSFT: 378.9,
  AMZN: 145.2,
  TSLA: 242.8,
  META: 485.6,
  NVDA: 875.4,
  AMD: 165.3,
}

// Broadcast stock prices to all connected clients
function broadcastStockPrices() {
  if (clients.size === 0) return

  const stockData = stocks.map((symbol) =>
    generateStockPrice(symbol, basePrices[symbol])
  )

  const message = JSON.stringify({
    type: 'stock-update',
    data: stockData,
  })

  for (const client of clients) {
    if (client.isAlive && client.readyState === 1) {
      // 1 = OPEN
      client.send(message)
    }
  }
}

// Heartbeat mechanism
function heartbeat() {
  this.isAlive = true
}

// Set up heartbeat interval
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      clients.delete(ws)
      console.log(
        `Client disconnected (heartbeat timeout). Active clients: ${clients.size}`
      )
      ws.terminate()
      continue
    }

    ws.isAlive = false
    ws.ping()
  }
}, HEARTBEAT_INTERVAL)

// Set up broadcast interval
const broadcastInterval = setInterval(broadcastStockPrices, BROADCAST_INTERVAL)

// Handle new connections
wss.on('connection', (ws) => {
  ws.isAlive = true
  ws.on('pong', heartbeat)

  clients.add(ws)
  console.log(`New client connected. Active clients: ${clients.size}`)

  // Send initial stock data
  const initialData = stocks.map((symbol) =>
    generateStockPrice(symbol, basePrices[symbol])
  )

  ws.send(
    JSON.stringify({
      type: 'stock-update',
      data: initialData,
    })
  )

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws)
    console.log(`Client disconnected. Active clients: ${clients.size}`)
  })

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    clients.delete(ws)
  })
})

// Clean up on server shutdown
wss.on('close', () => {
  clearInterval(heartbeatInterval)
  clearInterval(broadcastInterval)
})

console.log(`WebSocket server is running on ws://localhost:${PORT}`)
console.log('Broadcasting stock prices every', BROADCAST_INTERVAL, 'ms')
console.log('Heartbeat interval:', HEARTBEAT_INTERVAL, 'ms')
