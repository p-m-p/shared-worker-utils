/**
 * Manages broadcasting messages to multiple ports
 */
export class Broadcaster<TPort = MessagePort> {
  /**
   * Broadcast a message to all provided ports
   */
  broadcast(ports: TPort[], message: unknown): void {
    for (const port of ports) {
      ;(port as MessagePort).postMessage(message)
    }
  }

  /**
   * Send a message to a single port
   */
  send(port: TPort, message: unknown): void {
    ;(port as MessagePort).postMessage(message)
  }
}
