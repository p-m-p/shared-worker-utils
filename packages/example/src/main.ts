import './style.css'
import { SharedWorkerClient } from 'shared-worker-utils'

// DOM elements
const connectionStatus = document.querySelector('#connection-status')!
const tabCount = document.querySelector('#tab-count')!
const activeTabCount = document.querySelector('#active-tab-count')!
const tabVisibility = document.querySelector('#tab-visibility')!
const stockTbody = document.querySelector('#stock-tbody')!

// Store stock data
interface StockData {
  symbol: string
  price: string
  change: string
  percentChange: string
  timestamp: string
}

// Define message types from SharedWorker
type WorkerMessage =
  | { type: 'connection-status'; status: string }
  | { type: 'stock-update'; data: StockData[] }
  | { type: 'client-info'; total: number; active: number }

let currentStockData: StockData[] = []

// Update connection status UI
function updateConnectionStatus(status: string) {
  connectionStatus.textContent =
    status === 'connected' ? 'Connected' : 'Disconnected'
  connectionStatus.className = `status ${status}`
}

// Update client count UI
function updateClientCounts(total: number, active: number) {
  tabCount.textContent = total.toString()
  activeTabCount.textContent = active.toString()
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// Update stock table
function updateStockTable(stocks: StockData[]) {
  // Store the data
  currentStockData = stocks

  // Don't update UI if tab is not visible
  if (!portWrapper.isVisible()) {
    return
  }

  // Clear existing rows
  stockTbody.innerHTML = ''

  // Create rows for each stock
  for (const stock of stocks) {
    const row = document.createElement('tr')
    const changeNumber = Number.parseFloat(stock.change)
    const changeClass = changeNumber >= 0 ? 'positive' : 'negative'

    row.innerHTML = `
      <td class="symbol">${stock.symbol}</td>
      <td class="price">$${stock.price}</td>
      <td class="change ${changeClass}">${changeNumber >= 0 ? '+' : ''}${stock.change}</td>
      <td class="change ${changeClass}">${changeNumber >= 0 ? '+' : ''}${stock.percentChange}%</td>
      <td class="timestamp">${formatTime(stock.timestamp)}</td>
    `

    stockTbody.append(row)
  }
}

// Connect to SharedWorker using SharedWorkerClient
const worker = new SharedWorker(new URL('shared-worker.ts', import.meta.url), {
  type: 'module',
  name: 'stock-websocket-worker',
})

const portWrapper = new SharedWorkerClient<WorkerMessage>(worker, {
  onMessage: (message) => {
    switch (message.type) {
      case 'connection-status': {
        updateConnectionStatus(message.status)
        break
      }

      case 'stock-update': {
        updateStockTable(message.data)
        break
      }

      case 'client-info': {
        // Application-level client count message (not the internal client-count)
        updateClientCounts(message.total, message.active)
        updateVisibilityUI()
        break
      }
    }
  },
  onLog: (message, ...parameters) => {
    console.log(message, ...parameters)
  },
})

// Update visibility UI based on wrapper's visibility
const updateVisibilityUI = () => {
  const isVisible = portWrapper.isVisible()
  tabVisibility.textContent = isVisible ? 'Visible' : 'Hidden'
  tabVisibility.className = `status ${isVisible ? 'visible' : 'hidden'}`

  // If tab became visible and we have data, update the table
  if (isVisible && currentStockData.length > 0) {
    updateStockTable(currentStockData)
  }
}

// Initialize visibility UI
updateVisibilityUI()

// Listen for visibility changes to update UI
document.addEventListener('visibilitychange', updateVisibilityUI)
