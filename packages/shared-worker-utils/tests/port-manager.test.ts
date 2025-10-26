import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortManager } from '../src/port-manager';

// Mock MessagePort
class MockMessagePort {
  private listeners = new Map<string, (event: MessageEvent) => void>();

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  postMessage(data: any) {
    // Store sent messages for testing
    (this as any).lastMessage = data;
  }

  start() {
    // No-op for mock
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: any) {
    const listener = this.listeners.get('message');
    if (listener) {
      listener({ data });
    }
  }
}

describe('PortManager', () => {
  let portManager: PortManager;
  let mockPort: MockMessagePort;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    portManager?.destroy();
  });

  it('should initialize with default options', () => {
    portManager = new PortManager();
    expect(portManager.getTotalCount()).toBe(0);
    expect(portManager.getActiveCount()).toBe(0);
  });

  it('should handle new port connections', () => {
    const onLog = vi.fn();
    portManager = new PortManager({ onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    expect(portManager.getTotalCount()).toBe(1);
    expect(portManager.getActiveCount()).toBe(1);
    expect(onLog).toHaveBeenCalledWith(
      '[PortManager] New client connected. Total clients: 1'
    );
  });

  it('should broadcast client count on connect', () => {
    portManager = new PortManager();
    mockPort = new MockMessagePort() as any;

    portManager.handleConnect(mockPort as any);

    expect((mockPort as any).lastMessage).toEqual({
      type: 'client-count',
      total: 1,
      active: 1,
    });
  });

  it('should handle visibility change messages', () => {
    const onLog = vi.fn();
    portManager = new PortManager({ onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    // Change visibility to hidden
    mockPort.simulateMessage({ type: 'visibility-change', visible: false });

    expect(portManager.getActiveCount()).toBe(0);
    expect(portManager.getTotalCount()).toBe(1);
  });

  it('should handle disconnect messages', () => {
    portManager = new PortManager();
    mockPort = new MockMessagePort() as any;

    portManager.handleConnect(mockPort as any);
    expect(portManager.getTotalCount()).toBe(1);

    mockPort.simulateMessage({ type: 'disconnect' });

    expect(portManager.getTotalCount()).toBe(0);
  });

  it('should broadcast messages to all clients', () => {
    portManager = new PortManager();

    const port1 = new MockMessagePort() as any;
    const port2 = new MockMessagePort() as any;

    portManager.handleConnect(port1);
    portManager.handleConnect(port2);

    const testMessage = { type: 'test', data: 'hello' };
    portManager.broadcast(testMessage);

    expect(port1.lastMessage).toEqual(testMessage);
    expect(port2.lastMessage).toEqual(testMessage);
  });

  it('should send ping messages on interval', () => {
    const onLog = vi.fn();
    portManager = new PortManager({ pingInterval: 5000, onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    // Clear initial messages
    (mockPort as any).lastMessage = null;

    // Advance time to trigger ping
    vi.advanceTimersByTime(5000);

    expect((mockPort as any).lastMessage).toEqual({ type: 'ping' });
    expect(onLog).toHaveBeenCalledWith('[PortManager] Sending ping to client');
  });

  it('should handle pong responses', () => {
    const onLog = vi.fn();
    portManager = new PortManager({ onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    mockPort.simulateMessage({ type: 'pong' });

    expect(onLog).toHaveBeenCalledWith('[PortManager] Received pong from client');
  });

  it('should remove stale clients that do not respond to ping', () => {
    const onLog = vi.fn();
    const pingInterval = 10000;
    const pingTimeout = 5000;

    portManager = new PortManager({ pingInterval, pingTimeout, onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    expect(portManager.getTotalCount()).toBe(1);

    // Advance time to trigger first ping
    vi.advanceTimersByTime(pingInterval);

    // Advance time past timeout without responding, then to next interval check
    vi.advanceTimersByTime(pingTimeout + pingInterval);

    expect(portManager.getTotalCount()).toBe(0);
    expect(onLog).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 stale client(s)')
    );
  });

  it('should not remove clients that respond to ping', () => {
    const pingInterval = 10000;
    const pingTimeout = 5000;

    portManager = new PortManager({ pingInterval, pingTimeout });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    // Advance to first ping
    vi.advanceTimersByTime(pingInterval);

    // Respond with pong
    mockPort.simulateMessage({ type: 'pong' });

    // Advance past timeout
    vi.advanceTimersByTime(pingTimeout + 1000);

    // Client should still be connected
    expect(portManager.getTotalCount()).toBe(1);
  });

  it('should re-add client that sends message after being removed', () => {
    const onLog = vi.fn();
    const pingInterval = 5000;
    const pingTimeout = 2000;
    portManager = new PortManager({ pingInterval, pingTimeout, onLog });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    // Advance to first ping, then past timeout and to next check to remove client
    vi.advanceTimersByTime(pingInterval);
    vi.advanceTimersByTime(pingTimeout + pingInterval);

    expect(portManager.getTotalCount()).toBe(0);

    // Client sends a message (e.g., after computer wakes from sleep)
    mockPort.simulateMessage({ type: 'pong' });

    expect(portManager.getTotalCount()).toBe(1);
    expect(onLog).toHaveBeenCalledWith('[PortManager] Reconnecting previously removed client');
  });

  it('should call onActiveCountChange callback', () => {
    const onActiveCountChange = vi.fn();
    portManager = new PortManager({ onActiveCountChange });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    expect(onActiveCountChange).toHaveBeenCalledWith(1, 1);

    mockPort.simulateMessage({ type: 'visibility-change', visible: false });

    expect(onActiveCountChange).toHaveBeenCalledWith(0, 1);
  });

  it('should call onMessage for non-internal message types', () => {
    const onMessage = vi.fn();
    portManager = new PortManager({ onMessage });

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    const customMessage = { type: 'custom', data: 'test' };
    mockPort.simulateMessage(customMessage);

    expect(onMessage).toHaveBeenCalledWith(mockPort, customMessage);
  });

  it('should clean up on destroy', () => {
    portManager = new PortManager();

    mockPort = new MockMessagePort() as any;
    portManager.handleConnect(mockPort as any);

    portManager.destroy();

    expect(portManager.getTotalCount()).toBe(0);
  });
});
