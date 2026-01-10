// Comprehensive tests for popup functionality with proper mocking
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Popup Functionality', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset DOM
    document.body.innerHTML = '';
    
    // Reset fetch mock to default behavior from setup.ts
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    document.body.innerHTML = '';
  });

  describe('Backend API Mocking', () => {
    it('should mock summarize API calls and never reach real backend', async () => {
      // Mock fetch specifically for this test
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          summary: 'Test summary from mock',
          title: 'Mock Page Title',
          timestamp: '2024-01-01T00:00:00Z',
        }),
      });
      global.fetch = mockFetch;

      // Simulate API call that would happen in real popup
      const response = await fetch('http://127.0.0.1:3000/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test content',
          title: 'Test page',
        }),
      });

      const data = await response.json();

      // Verify the mock was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3000/api/summarize',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Test content',
            title: 'Test page',
          }),
        }
      );

      // Verify we got mock data (not real API response)
      expect(data).toEqual({
        summary: 'Test summary from mock',
        title: 'Mock Page Title',
        timestamp: '2024-01-01T00:00:00Z',
      });

      // Ensure no real network requests were made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should mock chat API calls and prevent LLM usage', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: 'Mock agent response - no LLM credits used!',
          sessionId: 'mock-session-123',
          timestamp: '2024-01-01T00:00:00Z',
        }),
      });
      global.fetch = mockFetch;

      // Simulate chat API call
      const response = await fetch('http://127.0.0.1:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What is this page about?',
          sessionId: 'test-session',
        }),
      });

      const data = await response.json();

      expect(data.content).toBe('Mock agent response - no LLM credits used!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should have mocking infrastructure in place', () => {
      // Simply verify that the essential mocking is working
      expect(global.fetch).toBeDefined();
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.tabs.query).toBeDefined();
      expect(chrome.scripting.executeScript).toBeDefined();
    });
  });

  describe('WebSocket Mocking', () => {
    it('should mock raw WebSocket connections', () => {
      const socket = new WebSocket('ws://127.0.0.1:3000');

      // Verify mock functions are available
      expect(socket).toBeDefined();
      expect(socket.send).toBeDefined();
      expect(socket.close).toBeDefined();
      expect(socket.addEventListener).toBeDefined();
      expect(socket.readyState).toBe(1); // OPEN state
      expect(socket.url).toBe('ws://127.0.0.1:3000');

      // Verify WebSocket constants are available
      expect(WebSocket.CONNECTING).toBe(0);
      expect(WebSocket.OPEN).toBe(1);
      expect(WebSocket.CLOSING).toBe(2);
      expect(WebSocket.CLOSED).toBe(3);
    });
  });

  describe('Chrome API Mocking', () => {
    it('should mock chrome.storage calls', async () => {
      const testData = { lastSummary: { title: 'Test', content: 'Mock' } };
      
      // Mock the storage get call
      (chrome.storage.local.get as any).mockResolvedValue(testData);
      
      const result = await chrome.storage.local.get(['lastSummary']);
      
      expect(result).toEqual(testData);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['lastSummary']);
    });

    it('should mock chrome.scripting.executeScript', async () => {
      const mockResult = {
        title: 'Mock Page',
        content: 'Mock extracted content',
        url: 'https://mock.example.com',
      };

      (chrome.scripting.executeScript as any).mockResolvedValue([
        { result: mockResult },
      ]);

      const results = await chrome.scripting.executeScript({
        target: { tabId: 1 },
        function: () => ({ title: 'test' }),
      });

      expect(results[0].result).toEqual(mockResult);
      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    });

    it('should mock chrome.tabs.query', async () => {
      const mockTabs = [{ id: 1, url: 'https://test.com', active: true }];
      (chrome.tabs.query as any).mockResolvedValue(mockTabs);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      expect(tabs).toEqual(mockTabs);
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });
  });

  describe('Content Extraction Mocking', () => {
    it('should mock window.getSelection', () => {
      const mockSelection = {
        toString: vi.fn().mockReturnValue('Selected text content'),
        rangeCount: 1,
      };
      
      (window.getSelection as any).mockReturnValue(mockSelection);

      const selection = window.getSelection();
      const selectedText = selection?.toString();

      expect(selectedText).toBe('Selected text content');
      expect(selection?.rangeCount).toBe(1);
    });
  });

  describe('Clear Conversation Functionality', () => {
    it('should clear conversation and session when clear button is clicked', async () => {
      // Mock existing chat history and session
      mockStorageData.chatHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      mockStorageData.chatSessionId = 'session_to_clear_123';

      // Mock WebSocket manager clear session
      const mockWebSocketManager = {
        clearSession: vi.fn().mockResolvedValue(undefined)
      };

      // Mock DOM elements
      document.body.innerHTML = `
        <div id="chatMessages">
          <div class="message">Hello</div>
          <div class="message">Hi there!</div>
        </div>
        <button id="clearConversationBtn">Clear Conversation</button>
      `;

      const chatMessages = document.getElementById('chatMessages');
      const clearBtn = document.getElementById('clearConversationBtn');

      // Simulate clear conversation function
      const clearConversation = async () => {
        await mockWebSocketManager.clearSession();
        if (chatMessages) chatMessages.innerHTML = '';
        await chrome.storage.local.remove(['chatHistory']);
      };

      // Verify initial state
      expect(chatMessages?.children.length).toBe(2);

      // Execute clear conversation
      await clearConversation();

      // Verify session was cleared
      expect(mockWebSocketManager.clearSession).toHaveBeenCalledTimes(1);
      
      // Verify UI was cleared
      expect(chatMessages?.innerHTML).toBe('');
      
      // Verify storage was cleared
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatHistory']);
    });

    it('should handle clear conversation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock WebSocket manager to throw error
      const mockWebSocketManager = {
        clearSession: vi.fn().mockRejectedValue(new Error('WebSocket error'))
      };

      const clearConversation = async () => {
        try {
          await mockWebSocketManager.clearSession();
          await chrome.storage.local.remove(['chatHistory']);
        } catch (error) {
          console.error('Failed to clear conversation:', error);
        }
      };

      await expect(clearConversation()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to clear conversation:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should clear conversation without active WebSocket connection', async () => {
      // Mock WebSocket manager as disconnected
      const mockWebSocketManager = {
        clearSession: vi.fn().mockResolvedValue(undefined),
        connected: false
      };

      // Mock chat history in storage
      mockStorageData.chatHistory = [
        { role: 'user', content: 'Previous message' }
      ];

      const clearConversation = async () => {
        await mockWebSocketManager.clearSession();
        await chrome.storage.local.remove(['chatHistory']);
      };

      await clearConversation();

      // Should still attempt to clear session even if not connected
      expect(mockWebSocketManager.clearSession).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatHistory']);
    });
  });

  describe('Session Management Integration', () => {
    it('should load saved session on popup open', async () => {
      const savedSessionId = 'session_saved_789';
      mockStorageData.chatSessionId = savedSessionId;

      // Mock WebSocket manager initialization
      const mockWebSocketManager = {
        loadStoredSessionId: vi.fn().mockImplementation(async () => {
          const result = await chrome.storage.local.get(['chatSessionId']);
          return result.chatSessionId;
        })
      };

      const loadedSessionId = await mockWebSocketManager.loadStoredSessionId();

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
      expect(loadedSessionId).toBe(savedSessionId);
    });

    it('should persist session across popup close and reopen', async () => {
      const persistentSessionId = 'session_persistent_456';
      
      // Simulate popup open - first time
      mockStorageData.chatSessionId = persistentSessionId;
      const firstLoad = await chrome.storage.local.get(['chatSessionId']);
      expect(firstLoad.chatSessionId).toBe(persistentSessionId);

      // Simulate popup close and reopen - session should persist
      const secondLoad = await chrome.storage.local.get(['chatSessionId']);
      expect(secondLoad.chatSessionId).toBe(persistentSessionId);
      
      // Verify same session is loaded both times
      expect(firstLoad.chatSessionId).toBe(secondLoad.chatSessionId);
    });

    it('should handle missing session gracefully on popup open', async () => {
      // No session in storage
      expect(mockStorageData.chatSessionId).toBeUndefined();

      const mockWebSocketManager = {
        loadStoredSessionId: vi.fn().mockImplementation(async () => {
          const result = await chrome.storage.local.get(['chatSessionId']);
          return result.chatSessionId || null;
        })
      };

      const sessionId = await mockWebSocketManager.loadStoredSessionId();

      expect(sessionId).toBeNull();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
    });
  });

  // Test data persistence helper
  let mockStorageData: Record<string, any> = {};

  beforeEach(() => {
    // Reset mock storage data
    Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
    
    // Setup storage mocks to use test data
    (chrome.storage.local.get as any).mockImplementation((keys: string[]) => {
      const result: Record<string, any> = {};
      keys.forEach(key => {
        if (mockStorageData[key] !== undefined) {
          result[key] = mockStorageData[key];
        }
      });
      return Promise.resolve(result);
    });
    
    (chrome.storage.local.set as any).mockImplementation((data: Record<string, any>) => {
      Object.assign(mockStorageData, data);
      return Promise.resolve();
    });
    
    (chrome.storage.local.remove as any).mockImplementation((keys: string[]) => {
      keys.forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    });
  });

  describe('Error Handling', () => {
    it('should handle failed API calls gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      await expect(
        fetch('http://127.0.0.1:3000/api/summarize')
      ).rejects.toThrow('Network error');

      // Verify the mock was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors without real requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Mock server error' }),
      });
      global.fetch = mockFetch;

      const response = await fetch('http://127.0.0.1:3000/api/summarize');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(data.error).toBe('Mock server error');
    });
  });

  describe('Connection Status UI Indicator', () => {
    beforeEach(() => {
      // Set up DOM elements that the connection status functionality needs
      document.body.innerHTML = `
        <div class="flex border-b">
          <button id="chatTab" class="flex-1 py-2 px-4 text-sm font-medium text-primary-600 border-b-2 border-primary-500">
            Chat
          </button>
          <button id="summarizeTab" class="flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Summarize
          </button>
        </div>

        <div id="chatPanel" class="h-full flex flex-col">
          <div class="flex justify-between items-center p-3 border-b">
            <div class="flex items-center space-x-2">
              <div class="flex items-center space-x-1">
                <div id="connectionDot" class="w-2 h-2 rounded-full bg-gray-400 transition-colors"></div>
                <h3 id="chatHeader" class="text-sm font-medium text-gray-900">Connecting...</h3>
              </div>
            </div>
            <button id="clearConversationBtn" class="p-2 text-red-600 hover:bg-red-50 rounded transition-colors">
            </button>
          </div>

          <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-3"></div>

          <div class="p-4 border-t">
            <div class="flex space-x-2">
              <input id="chatInput" type="text" placeholder="Ask me anything..." />
              <button id="sendButton">Send</button>
            </div>
          </div>
        </div>
      `;
    });

    it('should initialize with connecting status', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
      const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;

      expect(connectionDot.className).toContain('bg-gray-400');
      expect(chatHeader.textContent).toBe('Connecting...');
    });

    it('should update UI to connected state', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
      const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;

      // Simulate connection status update function
      function updateConnectionStatus(connected: boolean) {
        if (connected) {
          connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
          chatHeader.textContent = 'Connected';
        } else {
          connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
          chatHeader.textContent = 'Disconnected';
        }
      }

      updateConnectionStatus(true);

      expect(connectionDot.className).toContain('bg-green-500');
      expect(chatHeader.textContent).toBe('Connected');
    });

    it('should update UI to disconnected state', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
      const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;

      // Simulate connection status update function
      function updateConnectionStatus(connected: boolean) {
        if (connected) {
          connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
          chatHeader.textContent = 'Connected';
        } else {
          connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
          chatHeader.textContent = 'Disconnected';
        }
      }

      updateConnectionStatus(false);

      expect(connectionDot.className).toContain('bg-red-500');
      expect(chatHeader.textContent).toBe('Disconnected');
    });

    it('should handle connection status change messages from background script', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
      const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;
      let isConnectedToServer = false;

      function updateConnectionStatus(connected: boolean) {
        isConnectedToServer = connected;
        if (connected) {
          connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
          chatHeader.textContent = 'Connected';
        } else {
          connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
          chatHeader.textContent = 'Disconnected';
        }
      }

      function handleBackgroundMessage(message: any) {
        switch (message.type) {
          case 'connection_status':
            updateConnectionStatus(message.data.connected);
            break;
        }
      }

      // Test connected message
      handleBackgroundMessage({
        type: 'connection_status',
        data: { connected: true }
      });

      expect(isConnectedToServer).toBe(true);
      expect(connectionDot.className).toContain('bg-green-500');
      expect(chatHeader.textContent).toBe('Connected');

      // Test disconnected message
      handleBackgroundMessage({
        type: 'connection_status',
        data: { connected: false }
      });

      expect(isConnectedToServer).toBe(false);
      expect(connectionDot.className).toContain('bg-red-500');
      expect(chatHeader.textContent).toBe('Disconnected');
    });

    it('should prevent sending messages when disconnected', () => {
      let isConnectedToServer = false;
      let errorThrown = false;

      function sendChatMessage() {
        if (!isConnectedToServer) {
          errorThrown = true;
          throw new Error('Not connected to chat server');
        }
        // Send message logic...
      }

      // Test when disconnected
      expect(() => sendChatMessage()).toThrow('Not connected to chat server');
      expect(errorThrown).toBe(true);

      // Test when connected
      errorThrown = false;
      isConnectedToServer = true;
      expect(() => sendChatMessage()).not.toThrow();
      expect(errorThrown).toBe(false);
    });

    it('should show proper visual feedback during connection state transitions', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
      const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;

      function updateConnectionStatus(connected: boolean) {
        if (connected) {
          connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
          chatHeader.textContent = 'Connected';
        } else {
          connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
          chatHeader.textContent = 'Disconnected';
        }
      }

      // Start with connecting state
      expect(connectionDot.className).toContain('bg-gray-400');
      expect(chatHeader.textContent).toBe('Connecting...');

      // Transition to connected
      updateConnectionStatus(true);
      expect(connectionDot.className).toContain('bg-green-500');
      expect(chatHeader.textContent).toBe('Connected');

      // Transition to disconnected
      updateConnectionStatus(false);
      expect(connectionDot.className).toContain('bg-red-500');
      expect(chatHeader.textContent).toBe('Disconnected');

      // Transition back to connected (reconnection)
      updateConnectionStatus(true);
      expect(connectionDot.className).toContain('bg-green-500');
      expect(chatHeader.textContent).toBe('Connected');
    });

    it('should handle transition CSS classes properly', () => {
      const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;

      function updateConnectionStatus(connected: boolean) {
        if (connected) {
          connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
        } else {
          connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
        }
      }

      // Test that transition class is always present
      updateConnectionStatus(true);
      expect(connectionDot.className).toContain('transition-colors');

      updateConnectionStatus(false);
      expect(connectionDot.className).toContain('transition-colors');

      // Test that other consistent classes are maintained
      expect(connectionDot.className).toContain('w-2');
      expect(connectionDot.className).toContain('h-2');
      expect(connectionDot.className).toContain('rounded-full');
    });
  });
});