export interface PortManagerOptions {
  /**
   * Interval between ping messages in milliseconds
   * @default 10000
   */
  pingInterval?: number;

  /**
   * Maximum time to wait for pong response after ping in milliseconds
   * @default 5000
   */
  pingTimeout?: number;

  /**
   * Callback when active or total client count changes
   */
  onActiveCountChange?: (activeCount: number, totalCount: number) => void;

  /**
   * Callback for custom messages not handled by PortManager
   */
  onCustomMessage?: (port: MessagePort, message: any) => void;

  /**
   * Callback for internal logging
   */
  onLog?: (message: string, ...args: any[]) => void;
}

export interface PortWrapperOptions {
  /**
   * Callback for all received messages from SharedWorker
   */
  onMessage: (message: any) => void;

  /**
   * Callback for internal logging
   */
  onLog?: (message: string, ...args: any[]) => void;
}

export interface ClientState {
  visible: boolean;
  lastPong: number;
}

export interface ClientCountMessage {
  type: 'client-count';
  total: number;
  active: number;
}

export interface VisibilityChangeMessage {
  type: 'visibility-change';
  visible: boolean;
}

export interface DisconnectMessage {
  type: 'disconnect';
}

export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
}

export type InternalMessage =
  | ClientCountMessage
  | VisibilityChangeMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage;
