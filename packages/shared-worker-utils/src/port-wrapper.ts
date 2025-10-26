import type { PortWrapperOptions } from './types';

/**
 * Wraps a SharedWorker port connection on the client side
 * Handles visibility tracking, ping/pong responses, and cleanup
 */
export class PortWrapper {
  private port: MessagePort;
  private onMessage: (message: any) => void;
  private onLog?: (message: string, ...args: any[]) => void;
  private isTabVisible: boolean;

  constructor(worker: SharedWorker, options: PortWrapperOptions) {
    this.port = worker.port;
    this.onMessage = options.onMessage;
    this.onLog = options.onLog;
    this.isTabVisible = !document.hidden;

    this.setupMessageHandler();
    this.setupVisibilityHandler();
    this.setupUnloadHandler();

    this.port.start();

    this.log('Connected to SharedWorker');
    this.log(`Tab visibility: ${this.isTabVisible ? 'visible' : 'hidden'}`);
  }

  /**
   * Send a message to the SharedWorker
   */
  send(message: any): void {
    this.port.postMessage(message);
  }

  /**
   * Disconnect from the SharedWorker
   */
  disconnect(): void {
    this.send({ type: 'disconnect' });
  }

  /**
   * Check if the tab is currently visible
   */
  isVisible(): boolean {
    return this.isTabVisible;
  }

  private setupMessageHandler(): void {
    this.port.onmessage = (event) => {
      const message = event.data;

      // Handle internal ping messages
      if (message.type === 'ping') {
        this.log('Received ping from SharedWorker, sending pong');
        this.send({ type: 'pong' });
        return;
      }

      // Pass all other messages to the consumer
      this.onMessage(message);
    };
  }

  private setupVisibilityHandler(): void {
    const handleVisibilityChange = () => {
      const wasVisible = this.isTabVisible;
      this.isTabVisible = !document.hidden;

      if (wasVisible !== this.isTabVisible) {
        this.log(`Tab visibility changed: ${this.isTabVisible ? 'visible' : 'hidden'}`);

        // Notify SharedWorker of visibility change
        this.send({
          type: 'visibility-change',
          visible: this.isTabVisible,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  private log(message: string, ...args: any[]): void {
    this.onLog?.(`[PortWrapper] ${message}`, ...args);
  }
}
