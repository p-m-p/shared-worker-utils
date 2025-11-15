/**
 * Handles processing of incoming messages from ports
 * Distinguishes between internal messages and application messages
 */
export class MessageHandler<TPort = MessagePort, TMessage = unknown> {
  private onVisibilityChange?: (port: TPort, visible: boolean) => void
  private onDisconnect?: (port: TPort) => void
  private onPong?: (port: TPort) => void
  private onAppMessage?: (port: TPort, message: TMessage) => void

  constructor(callbacks: {
    onVisibilityChange?: (port: TPort, visible: boolean) => void
    onDisconnect?: (port: TPort) => void
    onPong?: (port: TPort) => void
    onAppMessage?: (port: TPort, message: TMessage) => void
  }) {
    this.onVisibilityChange = callbacks.onVisibilityChange
    this.onDisconnect = callbacks.onDisconnect
    this.onPong = callbacks.onPong
    this.onAppMessage = callbacks.onAppMessage
  }

  /**
   * Process an incoming message and route it to the appropriate handler
   */
  handle(port: TPort, data: unknown): void {
    // Type guard for internal messages
    const message = data as { type?: string; visible?: boolean }

    switch (message.type) {
      case '@shared-worker-utils/visibility-change': {
        this.onVisibilityChange?.(port, message.visible ?? true)
        break
      }
      case '@shared-worker-utils/disconnect': {
        this.onDisconnect?.(port)
        break
      }
      case '@shared-worker-utils/pong': {
        this.onPong?.(port)
        break
      }
      default: {
        // Non-internal message - pass through to application
        this.onAppMessage?.(port, data as TMessage)
      }
    }
  }
}
