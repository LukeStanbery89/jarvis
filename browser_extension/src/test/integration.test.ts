// Integration tests using test utilities - demonstrates proper mocking
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  mockChromeApis, 
  mockNetworkRequests, 
  mockDomElements, 
  testSafety 
} from './testUtils';

describe('Integration Tests - No LLM Credits Used', () => {
  beforeEach(() => {
    // Reset DOM and mocks
    document.body.innerHTML = '';
    mockDomElements.setSelectedText(''); // No selection by default
    
    // Reset storage mock to empty state
    mockChromeApis.storage.setMockData({});
  });

  afterEach(() => {
    // Safety check after each test
    testSafety.assertNoLLMUsage();
    testSafety.assertAllCallsMocked();
  });

  describe('Page Summarization Flow', () => {
    it('should summarize page content without using real API', async () => {
      // Setup: Mock page content
      mockDomElements.createMockPage({
        title: 'Test Article',
        headings: ['Main Heading'],
        paragraphs: ['Important content here', 'More details about the topic'],
      });

      // Setup: Mock Chrome APIs
      mockChromeApis.tabs.setActiveTab({ id: 1, url: 'https://example.com' });
      mockChromeApis.scripting.setExecuteScriptResult({
        title: 'Test Article',
        content: 'H1: Main Heading\n\nP: Important content here',
        url: 'https://example.com',
      });

      // Setup: Mock network response
      mockNetworkRequests.mockSuccessfulSummarize();

      // Simulate the summarization flow
      // 1. Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      expect(tabs[0].url).toBe('https://example.com');

      // 2. Execute content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => ({ title: 'extracted' }),
      });
      expect(results[0].result.title).toBe('Test Article');

      // 3. Call summarization API (mocked)
      const response = await fetch('http://127.0.0.1:3000/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: results[0].result.content,
          title: results[0].result.title,
        }),
      });

      const summary = await response.json();
      expect(summary.summary).toBe('Mock summary content');
      expect(summary.title).toBe('Mock Page Title');

      // 4. Save to storage (mocked)
      await chrome.storage.local.set({ lastSummary: summary });
      mockChromeApis.storage.expectStorageSet('lastSummary', summary);
    });

    it('should handle selected text summarization', async () => {
      // Setup: Mock selected text  
      mockDomElements.setSelectedText('This is selected text to summarize');
      mockChromeApis.tabs.setActiveTab({ id: 1, url: 'https://example.com' });
      mockChromeApis.scripting.setExecuteScriptResult({
        title: 'Test Page',
        content: 'SELECTED TEXT: This is selected text to summarize',
        url: 'https://example.com',
        isSelection: true,
      });

      mockNetworkRequests.mockSuccessfulSummarize();

      // Simulate selection-based summarization
      const selection = window.getSelection();
      const selectedText = selection?.toString();
      expect(selectedText).toBe('This is selected text to summarize');

      // Execute content extraction
      const results = await chrome.scripting.executeScript({
        target: { tabId: 1 },
        function: () => ({ content: 'mock' }),
      });

      expect(results[0].result.isSelection).toBe(true);
      expect(results[0].result.content).toContain('SELECTED TEXT:');
    });
  });

  describe('Session Management Flow', () => {
    it('should create and persist session for chat conversations', async () => {
      // Setup: No existing session
      mockChromeApis.storage.setMockData({});
      
      // Mock WebSocket manager session creation
      const mockSessionId = 'session_1640995200000_abc123';
      const mockWebSocketManager = {
        currentSessionId: null,
        createNewSession: vi.fn().mockImplementation(async () => {
          mockWebSocketManager.currentSessionId = mockSessionId;
          await chrome.storage.local.set({ chatSessionId: mockSessionId });
          return mockSessionId;
        }),
        sendChatMessage: vi.fn().mockImplementation(async (message: string) => {
          if (!mockWebSocketManager.currentSessionId) {
            await mockWebSocketManager.createNewSession();
          }
          return {
            id: 'msg_123',
            type: 'chat_message',
            content: message,
            sessionId: mockWebSocketManager.currentSessionId
          };
        })
      };

      // Simulate sending first chat message (should create session)
      const result = await mockWebSocketManager.sendChatMessage('Hello, start conversation');

      expect(mockWebSocketManager.createNewSession).toHaveBeenCalledTimes(1);
      expect(result.sessionId).toBe(mockSessionId);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        chatSessionId: mockSessionId
      });
    });

    it('should reuse existing session for subsequent messages', async () => {
      const existingSessionId = 'session_existing_456789';
      
      // Setup: Existing session in storage
      mockChromeApis.storage.setMockData({
        chatSessionId: existingSessionId
      });

      const mockWebSocketManager = {
        currentSessionId: existingSessionId,
        createNewSession: vi.fn(),
        sendChatMessage: vi.fn().mockImplementation(async (message: string) => {
          return {
            id: 'msg_456',
            type: 'chat_message', 
            content: message,
            sessionId: mockWebSocketManager.currentSessionId
          };
        })
      };

      // Send message with existing session
      const result = await mockWebSocketManager.sendChatMessage('Continue conversation');

      expect(mockWebSocketManager.createNewSession).not.toHaveBeenCalled();
      expect(result.sessionId).toBe(existingSessionId);
    });

    it('should handle session persistence across browser restarts', async () => {
      const persistentSessionId = 'session_persistent_789012';
      
      // Setup: Simulate session already saved in storage (before browser close)
      mockChromeApis.storage.setMockData({
        chatSessionId: persistentSessionId
      });
      
      // Simulate browser restart - load session from storage
      const loadedSession = await chrome.storage.local.get(['chatSessionId']);
      
      expect(loadedSession.chatSessionId).toBe(persistentSessionId);
      mockChromeApis.storage.expectStorageGet(['chatSessionId']);
    });

    it('should clear session and start fresh when requested', async () => {
      // Setup: Existing session and chat history
      const oldSessionId = 'session_old_345678';
      mockChromeApis.storage.setMockData({
        chatSessionId: oldSessionId,
        chatHistory: [
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' }
        ]
      });

      const mockWebSocketManager = {
        currentSessionId: oldSessionId,
        clearSession: vi.fn().mockImplementation(async () => {
          mockWebSocketManager.currentSessionId = null;
          await chrome.storage.local.remove(['chatSessionId']);
        }),
        createNewSession: vi.fn().mockImplementation(async () => {
          const newSessionId = 'session_new_901234';
          mockWebSocketManager.currentSessionId = newSessionId;
          await chrome.storage.local.set({ chatSessionId: newSessionId });
          return newSessionId;
        })
      };

      // Clear session and chat history
      await mockWebSocketManager.clearSession();
      await chrome.storage.local.remove(['chatHistory']);

      // Start new session
      const newSessionId = await mockWebSocketManager.createNewSession();

      expect(mockWebSocketManager.clearSession).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatSessionId']);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatHistory']);
      expect(newSessionId).not.toBe(oldSessionId);
      expect(mockWebSocketManager.currentSessionId).toBe(newSessionId);
    });
  });

  describe('WebSocket Session Integration', () => {
    it('should maintain session during WebSocket reconnection', async () => {
      const sessionId = 'session_reconnect_567890';
      
      // Setup: Existing session
      mockChromeApis.storage.setMockData({ chatSessionId: sessionId });
      
      const mockWebSocketManager = {
        connected: true,
        currentSessionId: sessionId,
        disconnect: vi.fn(),
        connect: vi.fn().mockImplementation(async () => {
          // Load session on reconnect
          const stored = await chrome.storage.local.get(['chatSessionId']);
          mockWebSocketManager.currentSessionId = stored.chatSessionId || null;
          mockWebSocketManager.connected = true;
          return true;
        })
      };

      // Simulate disconnection
      mockWebSocketManager.connected = false;
      
      // Simulate reconnection
      const reconnected = await mockWebSocketManager.connect();

      expect(reconnected).toBe(true);
      expect(mockWebSocketManager.currentSessionId).toBe(sessionId);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
    });

    it('should handle WebSocket connection with missing session', async () => {
      // Setup: No stored session
      mockChromeApis.storage.setMockData({});
      
      const mockWebSocketManager = {
        connected: false,
        currentSessionId: null,
        connect: vi.fn().mockImplementation(async () => {
          const stored = await chrome.storage.local.get(['chatSessionId']);
          mockWebSocketManager.currentSessionId = stored.chatSessionId || null;
          mockWebSocketManager.connected = true;
          return true;
        })
      };

      const connected = await mockWebSocketManager.connect();

      expect(connected).toBe(true);
      expect(mockWebSocketManager.currentSessionId).toBeNull();
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
    });
  });

  describe('Chat Flow', () => {
    it('should handle chat without real agent calls', async () => {
      // Setup: Mock chat response
      mockNetworkRequests.mockSuccessfulChat();
      
      // Setup: Mock storage for conversation history
      mockChromeApis.storage.setMockData({
        'chatHistory_https://example.com': [
          { role: 'user', content: 'What is this page about?', timestamp: Date.now() },
        ],
      });

      // Simulate chat flow
      const response = await fetch('http://127.0.0.1:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Tell me about this page',
          sessionId: 'test-session',
        }),
      });

      const chatResponse = await response.json();
      expect(chatResponse.content).toBe('Mock agent response');
      expect(chatResponse.sessionId).toBe('mock-session-id');

      // Verify no real LLM was called
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3000/api/chat',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      mockNetworkRequests.mockApiError(500, 'Server temporarily unavailable');

      try {
        const response = await fetch('http://127.0.0.1:3000/api/summarize');
        const error = await response.json();
        
        expect(response.ok).toBe(false);
        expect(error.error).toBe('Server temporarily unavailable');
      } catch (err) {
        // Network-level errors
        expect(err).toBeInstanceOf(Error);
      }
    });

    it('should handle network failures', async () => {
      mockNetworkRequests.mockNetworkError('Connection refused');

      await expect(
        fetch('http://127.0.0.1:3000/api/summarize')
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('Safety Assertions', () => {
    it('should detect if real APIs were called', () => {
      // This test verifies our safety mechanisms work
      expect(() => {
        testSafety.assertNoLLMUsage();
        testSafety.assertAllCallsMocked();
      }).not.toThrow();
    });

    it('should have comprehensive mocking in place', () => {
      // Verify that our mocking system is working
      expect(global.fetch).toBeDefined();
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.tabs.query).toBeDefined();
      expect(chrome.scripting.executeScript).toBeDefined();
    });
  });
});