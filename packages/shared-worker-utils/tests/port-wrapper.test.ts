import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortWrapper } from '../src/port-wrapper';

// Mock MessagePort for SharedWorker
class MockPort {
  onmessage: ((event: MessageEvent) => void) | null = null;
  private messages: any[] = [];

  postMessage(data: any) {
    this.messages.push(data);
  }

  start() {
    // No-op for mock
  }

  // Test helper to get last sent message
  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }

  // Test helper to get all messages
  getAllMessages() {
    return this.messages;
  }

  // Test helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

// Mock SharedWorker
class MockSharedWorker {
  port = new MockPort();
}

// Mock document
const mockDocument = {
  hidden: false,
  listeners: new Map<string, Function>(),
  addEventListener(type: string, listener: Function) {
    this.listeners.set(type, listener);
  },
  simulateVisibilityChange(hidden: boolean) {
    this.hidden = hidden;
    const listener = this.listeners.get('visibilitychange');
    if (listener) {
      listener();
    }
  },
};

// Mock window
const mockWindow = {
  listeners: new Map<string, Function>(),
  addEventListener(type: string, listener: Function) {
    this.listeners.set(type, listener);
  },
  simulateBeforeUnload() {
    const listener = this.listeners.get('beforeunload');
    if (listener) {
      listener();
    }
  },
};

describe('PortWrapper', () => {
  let mockWorker: MockSharedWorker;
  let portWrapper: PortWrapper;

  beforeEach(() => {
    mockWorker = new MockSharedWorker();
    // Override global document and window
    (global as any).document = mockDocument;
    (global as any).window = mockWindow;
    mockDocument.hidden = false;
    mockDocument.listeners.clear();
    mockWindow.listeners.clear();
  });

  it('should initialize and start the port', () => {
    const onMessage = vi.fn();
    const onLog = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage, onLog });

    expect(onLog).toHaveBeenCalledWith('[PortWrapper] Connected to SharedWorker');
    expect(onLog).toHaveBeenCalledWith('[PortWrapper] Tab visibility: visible');
  });

  it('should report correct initial visibility', () => {
    mockDocument.hidden = true;
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    expect(portWrapper.isVisible()).toBe(false);
  });

  it('should respond to ping messages with pong', () => {
    const onMessage = vi.fn();
    const onLog = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage, onLog });

    mockWorker.port.simulateMessage({ type: 'ping' });

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual({ type: 'pong' });
    expect(onLog).toHaveBeenCalledWith(
      '[PortWrapper] Received ping from SharedWorker, sending pong'
    );
  });

  it('should pass non-ping messages to onMessage callback', () => {
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    const testMessage = { type: 'test', data: 'hello' };
    mockWorker.port.simulateMessage(testMessage);

    expect(onMessage).toHaveBeenCalledWith(testMessage);
  });

  it('should send messages via send()', () => {
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    const testMessage = { type: 'custom', data: 'test' };
    portWrapper.send(testMessage);

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual(testMessage);
  });

  it('should send visibility change when tab becomes hidden', () => {
    const onMessage = vi.fn();
    const onLog = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage, onLog });

    // Clear initial messages
    mockWorker.port.getAllMessages().length = 0;

    // Simulate tab becoming hidden
    mockDocument.simulateVisibilityChange(true);

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual({
      type: 'visibility-change',
      visible: false,
    });
    expect(portWrapper.isVisible()).toBe(false);
    expect(onLog).toHaveBeenCalledWith('[PortWrapper] Tab visibility changed: hidden');
  });

  it('should send visibility change when tab becomes visible', () => {
    mockDocument.hidden = true;
    const onMessage = vi.fn();
    const onLog = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage, onLog });

    expect(portWrapper.isVisible()).toBe(false);

    // Clear initial messages
    mockWorker.port.getAllMessages().length = 0;

    // Simulate tab becoming visible
    mockDocument.simulateVisibilityChange(false);

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual({
      type: 'visibility-change',
      visible: true,
    });
    expect(portWrapper.isVisible()).toBe(true);
    expect(onLog).toHaveBeenCalledWith('[PortWrapper] Tab visibility changed: visible');
  });

  it('should not send visibility change if visibility does not actually change', () => {
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    const initialMessageCount = mockWorker.port.getAllMessages().length;

    // Simulate visibility change event but hidden state is the same
    mockDocument.simulateVisibilityChange(false);

    expect(mockWorker.port.getAllMessages().length).toBe(initialMessageCount);
  });

  it('should send disconnect message on beforeunload', () => {
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    mockWindow.simulateBeforeUnload();

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual({ type: 'disconnect' });
  });

  it('should send disconnect message when disconnect() is called', () => {
    const onMessage = vi.fn();

    portWrapper = new PortWrapper(mockWorker as any, { onMessage });

    portWrapper.disconnect();

    const lastMessage = mockWorker.port.getLastMessage();
    expect(lastMessage).toEqual({ type: 'disconnect' });
  });

  it('should work without onLog callback', () => {
    const onMessage = vi.fn();

    expect(() => {
      portWrapper = new PortWrapper(mockWorker as any, { onMessage });
    }).not.toThrow();
  });
});
