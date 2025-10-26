## Task

Create a demonstration of using a shared worker to manage a single websocket connection shared across multiple browser tabs.

## Server

- Set up a simple WebSocket server using Node.js and a websocket library
- Mock real time data broadcasting with stock prices
- add a heartbeat mechanism to keep the connection alive
- Track clients and implement logging to show the number of connected clients

## Shared worker

- Create a shared worker script that establishes a WebSocket connection to the server
- Use a web socket library in the worker to handle connection and heartbeat
- Implement message handling to broadcast messages received from the server to all connected tabs
- track active connections and only maintain socket connection when there are active tabs
- manage tab visibility changes to optimize resource usage

## Client

- Add a table to display real-time stock prices
- When the tab is backgrounded, pause updates to the table
