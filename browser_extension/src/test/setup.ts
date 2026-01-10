// Test setup file for Vitest
import { vi } from 'vitest';

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
    create: vi.fn().mockResolvedValue({ id: 2 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([{ result: { title: 'Test', content: 'Mock content' } }]),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    getURL: vi.fn().mockReturnValue('chrome-extension://test/'),
  },
} as any;

// Mock WebSocket manager module to prevent real WebSocket connections
vi.mock('../websocket.ts', () => ({
  WebSocketManager: vi.fn().mockImplementation(() => ({
    connected: false,
    currentSessionId: null,
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    sendChatMessage: vi.fn().mockResolvedValue({ id: 'mock', type: 'chat_message', content: 'mock' }),
    clearSession: vi.fn().mockResolvedValue(undefined),
    createNewSession: vi.fn().mockResolvedValue('session_mock_123'),
    loadStoredSessionId: vi.fn().mockResolvedValue(undefined),
    saveSessionId: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    getCurrentSessionId: vi.fn().mockReturnValue(null),
    startConnectionPolling: vi.fn(),
    stopConnectionPolling: vi.fn(),
    resetConnectionCheckTimer: vi.fn(),
    performConnectionCheck: vi.fn(),
    sendPing: vi.fn(),
  })),
}));

// Mock fetch to prevent real HTTP requests
global.fetch = vi.fn().mockImplementation((url: string) => {
  // Check if this is an unmocked endpoint that should fail
  if (url.includes('unknown-endpoint')) {
    return Promise.reject(new Error(`Unmocked fetch request to: ${url}`));
  }
  
  // Default mock responses based on URL patterns
  if (url.includes('/api/summarize')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        summary: 'Mock summary content',
        title: 'Mock Page Title',
        timestamp: new Date().toISOString(),
      }),
    });
  }
  
  if (url.includes('/api/chat')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        content: 'Mock agent response',
        sessionId: 'mock-session-id',
        timestamp: new Date().toISOString(),
      }),
    });
  }

  // Default fallback for other URLs
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

// Mock WebSocket to prevent real connections
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = 1; // OPEN
  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // Instance constants
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
  }
}

global.WebSocket = MockWebSocket as any;

// Setup DOM environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com',
    origin: 'https://example.com',
    pathname: '/test',
    search: '',
    hash: '',
  },
  writable: true,
});

// Mock window.getSelection for content extraction tests
Object.defineProperty(window, 'getSelection', {
  value: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue(''),
    rangeCount: 0,
  }),
  writable: true,
});

// Suppress console warnings for cleaner test output
const originalWarn = console.warn;
console.warn = vi.fn().mockImplementation((message: string) => {
  // Only show warnings that don't relate to our intentional mocking
  if (!message.includes('🚫 Attempted to fetch')) {
    originalWarn(message);
  }
});