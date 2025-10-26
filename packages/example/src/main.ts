import "./style.css";
import { PortWrapper } from "shared-worker-utils";

// DOM elements
const connectionStatus = document.getElementById("connection-status")!;
const tabCount = document.getElementById("tab-count")!;
const activeTabCount = document.getElementById("active-tab-count")!;
const tabVisibility = document.getElementById("tab-visibility")!;
const stockTbody = document.getElementById("stock-tbody")!;

// Store stock data
interface StockData {
  symbol: string;
  price: string;
  change: string;
  percentChange: string;
  timestamp: string;
}

let currentStockData: StockData[] = [];

// Update connection status UI
function updateConnectionStatus(status: string) {
  connectionStatus.textContent =
    status === "connected" ? "Connected" : "Disconnected";
  connectionStatus.className = `status ${status}`;
}

// Update client count UI
function updateClientCounts(total: number, active: number) {
  tabCount.textContent = total.toString();
  activeTabCount.textContent = active.toString();
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// Update stock table
function updateStockTable(stocks: StockData[]) {
  // Store the data
  currentStockData = stocks;

  // Don't update UI if tab is not visible
  if (!portWrapper.isVisible()) {
    return;
  }

  // Clear existing rows
  stockTbody.innerHTML = "";

  // Create rows for each stock
  stocks.forEach((stock) => {
    const row = document.createElement("tr");
    const changeNum = parseFloat(stock.change);
    const changeClass = changeNum >= 0 ? "positive" : "negative";

    row.innerHTML = `
      <td class="symbol">${stock.symbol}</td>
      <td class="price">$${stock.price}</td>
      <td class="change ${changeClass}">${changeNum >= 0 ? "+" : ""}${stock.change}</td>
      <td class="change ${changeClass}">${changeNum >= 0 ? "+" : ""}${stock.percentChange}%</td>
      <td class="timestamp">${formatTime(stock.timestamp)}</td>
    `;

    stockTbody.appendChild(row);
  });
}

// Connect to SharedWorker using PortWrapper
const worker = new SharedWorker(
  new URL("./shared-worker.ts", import.meta.url),
  { type: "module" },
);

const portWrapper = new PortWrapper(worker, {
  onMessage: (message) => {
    switch (message.type) {
      case "connection-status":
        updateConnectionStatus(message.status);
        break;

      case "stock-update":
        updateStockTable(message.data);
        break;

      case "client-info":
        // Application-level client count message (not the internal client-count)
        updateClientCounts(message.total, message.active);
        updateVisibilityUI();
        break;
    }
  },
  onLog: (message, ...args) => {
    console.log(message, ...args);
  },
});

// Update visibility UI based on wrapper's visibility
const updateVisibilityUI = () => {
  const isVisible = portWrapper.isVisible();
  tabVisibility.textContent = isVisible ? "Visible" : "Hidden";
  tabVisibility.className = `status ${isVisible ? "visible" : "hidden"}`;

  // If tab became visible and we have data, update the table
  if (isVisible && currentStockData.length > 0) {
    updateStockTable(currentStockData);
  }
};

// Initialize visibility UI
updateVisibilityUI();

// Listen for visibility changes to update UI
document.addEventListener("visibilitychange", updateVisibilityUI);
