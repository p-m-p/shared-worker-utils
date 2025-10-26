import type { PortManagerOptions, ClientState } from './types';

/**
 * Manages MessagePort connections in a SharedWorker
 * Handles ping/pong heartbeat, visibility tracking, and message broadcasting
 */
export class PortManager {
  private clients: Map<MessagePort, ClientState> = new Map();
  private pingInterval: number;
  private pingTimeout: number;
  private onActiveCountChange?: (activeCount: number, totalCount: number) => void;
  private onCustomMessage?: (port: MessagePort, message: any) => void;
  private onLog?: (message: string, ...args: any[]) => void;
  private pingIntervalId: ReturnType<typeof setInterval>;

  constructor(options: PortManagerOptions = {}) {
    this.pingInterval = options.pingInterval ?? 10000;
    this.pingTimeout = options.pingTimeout ?? 5000;
    this.onActiveCountChange = options.onActiveCountChange;
    this.onCustomMessage = options.onCustomMessage;
    this.onLog = options.onLog;

    // Start ping interval
    this.pingIntervalId = setInterval(() => this.checkClients(), this.pingInterval);

    this.log('PortManager initialized');
  }

  /**
   * Handle a new port connection
   */
  handleConnect(port: MessagePort): void {
    this.clients.set(port, { visible: true, lastPong: Date.now() });
    this.log(`New client connected. Total clients: ${this.clients.size}`);

    this.updateClientCount();

    port.addEventListener('message', (event) => {
      this.handleMessage(port, event.data);
    });

    port.start();
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: any): void {
    for (const [port] of this.clients) {
      port.postMessage(message);
    }
  }

  /**
   * Get the number of active (visible) clients
   */
  getActiveCount(): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.visible) count++;
    }
    return count;
  }

  /**
   * Get the total number of connected clients
   */
  getTotalCount(): number {
    return this.clients.size;
  }

  private handleMessage(port: MessagePort, data: any): void {
    let client = this.clients.get(port);

    // Re-add client if it was removed (e.g., after computer sleep)
    if (!client) {
      this.log('Reconnecting previously removed client');
      client = { visible: true, lastPong: Date.now() };
      this.clients.set(port, client);
      this.updateClientCount();
    }

    if (data.type === 'visibility-change') {
      client.visible = data.visible;
      this.log(`Client visibility changed: ${data.visible}`);
      this.updateClientCount();
    } else if (data.type === 'disconnect') {
      this.clients.delete(port);
      this.log(`Client disconnected. Remaining clients: ${this.clients.size}`);
      this.updateClientCount();
    } else if (data.type === 'pong') {
      client.lastPong = Date.now();
      this.log('Received pong from client');
    } else {
      // Custom message
      this.onCustomMessage?.(port, data);
    }
  }

  private checkClients(): void {
    const now = Date.now();
    let removedCount = 0;
    const staleThreshold = this.pingInterval + this.pingTimeout;

    for (const [port, client] of this.clients) {
      // Remove port if it hasn't responded to the last ping
      if (now - client.lastPong > staleThreshold) {
        this.clients.delete(port);
        removedCount++;
      } else {
        // Send ping
        this.log('Sending ping to client');
        port.postMessage({ type: 'ping' });
      }
    }

    // Update connection state if any ports were removed
    if (removedCount > 0) {
      this.log(`Removed ${removedCount} stale client(s). Remaining clients: ${this.clients.size}`);
      this.updateClientCount();
    }
  }

  private updateClientCount(): void {
    const activeCount = this.getActiveCount();
    const totalCount = this.getTotalCount();

    this.log(`Active clients: ${activeCount} / ${totalCount} total`);

    // Broadcast client count to all clients
    this.broadcast({
      type: 'client-count',
      total: totalCount,
      active: activeCount,
    });

    // Notify callback
    this.onActiveCountChange?.(activeCount, totalCount);
  }

  private log(message: string, ...args: any[]): void {
    this.onLog?.(`[PortManager] ${message}`, ...args);
  }

  /**
   * Clean up resources (stop ping interval)
   */
  destroy(): void {
    clearInterval(this.pingIntervalId);
    this.clients.clear();
    this.log('PortManager destroyed');
  }
}
