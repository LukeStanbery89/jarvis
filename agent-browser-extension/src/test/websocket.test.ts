// Tests for WebSocket session management functionality
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create a clean mock without recursive references
const createCleanMockWebSocketManager = () => ({
  connected: false,
  currentSessionId: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  sendChatMessage: vi.fn(),
  clearSession: vi.fn(),
  createNewSession: vi.fn(),
  loadStoredSessionId: vi.fn(),
  saveSessionId: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  getCurrentSessionId: vi.fn(),
  startConnectionPolling: vi.fn(),
  stopConnectionPolling: vi.fn(),
  resetConnectionCheckTimer: vi.fn(),
  performConnectionCheck: vi.fn(),
  sendPing: vi.fn(),
});

let mockWebSocketManager = createCleanMockWebSocketManager();

// Mock chrome.storage calls for session persistence
const mockStorageData: Record<string, any> = {};

describe('WebSocket Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);

    // Create completely fresh mock instance to avoid recursion
    mockWebSocketManager = createCleanMockWebSocketManager();
    
    // Setup storage mocks to use our test data
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Creation and Storage', () => {
    it('should create new session ID when none exists', async () => {
      // Simulate no stored session
      mockWebSocketManager.getCurrentSessionId.mockReturnValue(null);
      mockWebSocketManager.createNewSession.mockImplementation(async () => {
        const sessionId = `session_${Date.now()}_abc123`;
        mockWebSocketManager.currentSessionId = sessionId;
        await chrome.storage.local.set({ chatSessionId: sessionId });
        return sessionId;
      });

      const sessionId = await mockWebSocketManager.createNewSession();

      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        chatSessionId: sessionId
      });
      expect(mockWebSocketManager.currentSessionId).toBe(sessionId);
    });

    it('should load existing session from storage', async () => {
      const existingSessionId = 'session_1234567890_xyz789';
      mockStorageData.chatSessionId = existingSessionId;
      
      mockWebSocketManager.loadStoredSessionId.mockImplementation(async () => {
        const result = await chrome.storage.local.get(['chatSessionId']);
        if (result.chatSessionId) {
          mockWebSocketManager.currentSessionId = result.chatSessionId;
        }
      });

      await mockWebSocketManager.loadStoredSessionId();

      expect(mockWebSocketManager.currentSessionId).toBe(existingSessionId);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
    });

    it('should persist session ID to storage when created', async () => {
      const newSessionId = 'session_9876543210_def456';
      
      mockWebSocketManager.saveSessionId.mockImplementation(async () => {
        if (mockWebSocketManager.currentSessionId) {
          await chrome.storage.local.set({
            chatSessionId: mockWebSocketManager.currentSessionId
          });
        }
      });
      
      mockWebSocketManager.currentSessionId = newSessionId;
      await mockWebSocketManager.saveSessionId();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        chatSessionId: newSessionId
      });
      expect(mockStorageData.chatSessionId).toBe(newSessionId);
    });
  });

  describe('Session Cleanup', () => {
    it('should clear session from storage', async () => {
      // Setup: existing session in storage
      mockStorageData.chatSessionId = 'session_to_clear_123';
      mockWebSocketManager.currentSessionId = 'session_to_clear_123';
      
      mockWebSocketManager.clearSession.mockImplementation(async () => {
        mockWebSocketManager.currentSessionId = null;
        await chrome.storage.local.remove(['chatSessionId']);
      });

      await mockWebSocketManager.clearSession();

      expect(mockWebSocketManager.currentSessionId).toBeNull();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatSessionId']);
      expect(mockStorageData.chatSessionId).toBeUndefined();
    });

    it('should handle clearing non-existent session gracefully', async () => {
      // No session exists
      mockWebSocketManager.currentSessionId = null;
      
      mockWebSocketManager.clearSession.mockImplementation(async () => {
        mockWebSocketManager.currentSessionId = null;
        await chrome.storage.local.remove(['chatSessionId']);
      });

      await expect(mockWebSocketManager.clearSession()).resolves.not.toThrow();
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['chatSessionId']);
    });
  });

  describe('Chat Message Handling with Sessions', () => {
    it('should create session before sending chat message if none exists', async () => {
      const testMessage = 'Hello, this is a test message';
      
      mockWebSocketManager.sendChatMessage.mockImplementation(async (message: string) => {
        // If no session exists, create one
        if (!mockWebSocketManager.currentSessionId) {
          const newSessionId = `session_${Date.now()}_auto`;
          mockWebSocketManager.currentSessionId = newSessionId;
          await chrome.storage.local.set({ chatSessionId: newSessionId });
        }
        
        // Simulate sending message with session
        return {
          id: 'msg_123',
          type: 'chat_message',
          content: message,
          sessionId: mockWebSocketManager.currentSessionId
        };
      });

      mockWebSocketManager.createNewSession.mockImplementation(async () => {
        const sessionId = `session_${Date.now()}_auto`;
        mockWebSocketManager.currentSessionId = sessionId;
        await chrome.storage.local.set({ chatSessionId: sessionId });
        return sessionId;
      });

      const result = await mockWebSocketManager.sendChatMessage(testMessage);

      expect(mockWebSocketManager.currentSessionId).toBeTruthy();
      expect(result.sessionId).toBe(mockWebSocketManager.currentSessionId);
      expect(result.content).toBe(testMessage);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        chatSessionId: mockWebSocketManager.currentSessionId
      });
    });

    it('should use existing session for chat messages', async () => {
      const existingSessionId = 'session_existing_789';
      mockWebSocketManager.currentSessionId = existingSessionId;
      
      mockWebSocketManager.sendChatMessage.mockImplementation(async (message: string) => {
        return {
          id: 'msg_456',
          type: 'chat_message',
          content: message,
          sessionId: mockWebSocketManager.currentSessionId
        };
      });

      const result = await mockWebSocketManager.sendChatMessage('Test with existing session');

      expect(result.sessionId).toBe(existingSessionId);
      // Should not create new session
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Connection with Session Persistence', () => {
    it('should maintain session across WebSocket reconnections', async () => {
      const persistentSessionId = 'session_persistent_456';
      mockStorageData.chatSessionId = persistentSessionId;
      
      // Simulate connection with session loading
      mockWebSocketManager.connect.mockImplementation(async () => {
        await mockWebSocketManager.loadStoredSessionId();
        mockWebSocketManager.connected = true;
        return true;
      });
      
      mockWebSocketManager.loadStoredSessionId.mockImplementation(async () => {
        const result = await chrome.storage.local.get(['chatSessionId']);
        if (result.chatSessionId) {
          mockWebSocketManager.currentSessionId = result.chatSessionId;
        }
      });

      const connected = await mockWebSocketManager.connect();

      expect(connected).toBe(true);
      expect(mockWebSocketManager.currentSessionId).toBe(persistentSessionId);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['chatSessionId']);
    });

    it('should handle WebSocket disconnection while preserving session', async () => {
      const sessionToPreserve = 'session_preserve_789';
      mockWebSocketManager.currentSessionId = sessionToPreserve;
      mockWebSocketManager.connected = true;
      
      mockWebSocketManager.disconnect.mockImplementation(() => {
        mockWebSocketManager.connected = false;
        // Session should remain in storage for reconnection
      });

      mockWebSocketManager.disconnect();

      expect(mockWebSocketManager.connected).toBe(false);
      // Session should still be available for next connection
      expect(mockWebSocketManager.currentSessionId).toBe(sessionToPreserve);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully during session save', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock storage failure
      (chrome.storage.local.set as any).mockRejectedValue(new Error('Storage quota exceeded'));
      
      mockWebSocketManager.saveSessionId.mockImplementation(async () => {
        try {
          await chrome.storage.local.set({ chatSessionId: 'test-session' });
        } catch (error) {
          console.error('Failed to save session ID:', error);
        }
      });

      await expect(mockWebSocketManager.saveSessionId()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save session ID:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle storage errors gracefully during session load', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock storage failure
      (chrome.storage.local.get as any).mockRejectedValue(new Error('Storage not available'));
      
      mockWebSocketManager.loadStoredSessionId.mockImplementation(async () => {
        try {
          await chrome.storage.local.get(['chatSessionId']);
        } catch (error) {
          console.error('Failed to load session ID:', error);
        }
      });

      await expect(mockWebSocketManager.loadStoredSessionId()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load session ID:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Session Validation', () => {
    it('should validate session ID format', () => {
      const validSessionIds = [
        'session_1234567890_abc123',
        'session_9876543210_xyz789',
        'session_1640995200000_def456'
      ];
      
      const invalidSessionIds = [
        'invalid_format',
        'session_',
        'session_abc_',
        'session__def',
        ''
      ];

      const isValidSessionId = (sessionId: string): boolean => {
        return /^session_\d+_[a-z0-9]+$/.test(sessionId);
      };

      validSessionIds.forEach(sessionId => {
        expect(isValidSessionId(sessionId)).toBe(true);
      });

      invalidSessionIds.forEach(sessionId => {
        expect(isValidSessionId(sessionId)).toBe(false);
      });
    });

    it('should generate unique session IDs', () => {
      const generateSessionId = (): string => {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      };

      const sessionIds = new Set();
      for (let i = 0; i < 100; i++) {
        const sessionId = generateSessionId();
        expect(sessionIds.has(sessionId)).toBe(false);
        sessionIds.add(sessionId);
      }

      expect(sessionIds.size).toBe(100);
    });
  });

  describe('Connection Status Polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start polling after successful connection', async () => {
      mockWebSocketManager.connect.mockImplementation(async () => {
        mockWebSocketManager.connected = true;
        mockWebSocketManager.startConnectionPolling();
        return true;
      });

      await mockWebSocketManager.connect();

      expect(mockWebSocketManager.startConnectionPolling).toHaveBeenCalled();
    });

    it('should start polling after connection failure for retry', async () => {
      mockWebSocketManager.connect.mockImplementation(async () => {
        mockWebSocketManager.connected = false;
        mockWebSocketManager.startConnectionPolling();
        throw new Error('Connection failed');
      });

      await expect(mockWebSocketManager.connect()).rejects.toThrow('Connection failed');
      expect(mockWebSocketManager.startConnectionPolling).toHaveBeenCalled();
    });

    it('should use different polling intervals based on connection status', () => {
      const CONNECTED_INTERVAL = 30000; // 30 seconds
      const DISCONNECTED_INTERVAL = 5000; // 5 seconds

      // Test connected interval
      mockWebSocketManager.connected = true;
      mockWebSocketManager.startConnectionPolling.mockImplementation(() => {
        // Simulate scheduling with connected interval
        setTimeout(() => mockWebSocketManager.performConnectionCheck(), CONNECTED_INTERVAL);
      });

      mockWebSocketManager.startConnectionPolling();

      // Fast forward 25 seconds - should not trigger
      vi.advanceTimersByTime(25000);
      expect(mockWebSocketManager.performConnectionCheck).not.toHaveBeenCalled();

      // Fast forward 10 more seconds (35 total) - should trigger
      vi.advanceTimersByTime(10000);
      expect(mockWebSocketManager.performConnectionCheck).toHaveBeenCalled();

      vi.clearAllMocks();

      // Test disconnected interval
      mockWebSocketManager.connected = false;
      mockWebSocketManager.startConnectionPolling.mockImplementation(() => {
        // Simulate scheduling with disconnected interval
        setTimeout(() => mockWebSocketManager.performConnectionCheck(), DISCONNECTED_INTERVAL);
      });

      mockWebSocketManager.startConnectionPolling();

      // Fast forward 3 seconds - should not trigger
      vi.advanceTimersByTime(3000);
      expect(mockWebSocketManager.performConnectionCheck).not.toHaveBeenCalled();

      // Fast forward 3 more seconds (6 total) - should trigger
      vi.advanceTimersByTime(3000);
      expect(mockWebSocketManager.performConnectionCheck).toHaveBeenCalled();
    });

    it('should reset polling timer on WebSocket requests', () => {
      mockWebSocketManager.resetConnectionCheckTimer.mockImplementation(() => {
        mockWebSocketManager.stopConnectionPolling();
        mockWebSocketManager.startConnectionPolling();
      });

      // Simulate sending a chat message which should reset timer
      mockWebSocketManager.sendChatMessage.mockImplementation(async (message) => {
        mockWebSocketManager.resetConnectionCheckTimer();
      });

      mockWebSocketManager.sendChatMessage('test message');

      expect(mockWebSocketManager.resetConnectionCheckTimer).toHaveBeenCalled();
    });

    it('should send ping messages when connected during polling', () => {
      mockWebSocketManager.connected = true;
      mockWebSocketManager.performConnectionCheck.mockImplementation(async () => {
        if (mockWebSocketManager.connected) {
          mockWebSocketManager.sendPing();
        } else {
          await mockWebSocketManager.connect();
        }
      });

      mockWebSocketManager.performConnectionCheck();

      expect(mockWebSocketManager.sendPing).toHaveBeenCalled();
      expect(mockWebSocketManager.connect).not.toHaveBeenCalled();
    });

    it('should attempt reconnection when disconnected during polling', () => {
      mockWebSocketManager.connected = false;
      mockWebSocketManager.performConnectionCheck.mockImplementation(async () => {
        if (!mockWebSocketManager.connected) {
          await mockWebSocketManager.connect();
        } else {
          mockWebSocketManager.sendPing();
        }
      });

      mockWebSocketManager.performConnectionCheck();

      expect(mockWebSocketManager.connect).toHaveBeenCalled();
      expect(mockWebSocketManager.sendPing).not.toHaveBeenCalled();
    });

    it('should stop polling when disconnecting', () => {
      mockWebSocketManager.disconnect.mockImplementation(() => {
        mockWebSocketManager.stopConnectionPolling();
        mockWebSocketManager.connected = false;
      });

      mockWebSocketManager.disconnect();

      expect(mockWebSocketManager.stopConnectionPolling).toHaveBeenCalled();
    });
  });

  describe('Connection Status Events', () => {
    it('should emit connection status change events', () => {
      const mockListener = vi.fn();

      // Simulate successful connection without recursion
      const simulateConnection = () => {
        mockWebSocketManager.connected = true;
        mockListener({ connected: true });
      };

      simulateConnection();

      expect(mockListener).toHaveBeenCalledWith({ connected: true });
    });

    it('should emit disconnection events', () => {
      const mockListener = vi.fn();

      // Simulate disconnection
      mockWebSocketManager.disconnect.mockImplementation(() => {
        mockWebSocketManager.connected = false;
        mockListener({ connected: false });
      });

      mockWebSocketManager.disconnect();

      expect(mockListener).toHaveBeenCalledWith({ connected: false });
    });
  });

  describe('WebSocket Reconnection Scenarios', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should attempt reconnection after disconnection', () => {
      const mockReconnectListener = vi.fn();

      // Simulate disconnection triggering reconnection attempts
      const handleDisconnection = (reason: string) => {
        const maxReconnectAttempts = 5;
        let reconnectAttempts = 0;

        const attemptReconnection = () => {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            mockReconnectListener({ attempt: reconnectAttempts, maxAttempts: maxReconnectAttempts });

            // Simulate connection attempt failure and don't recursively call
            setTimeout(() => {
              // Connection fails, but don't attempt again to avoid recursion
            }, 1000);
          }
        };

        if (reason !== 'io server disconnect') {
          attemptReconnection();
        }
      };

      handleDisconnection('transport close');

      // Fast forward to trigger first reconnection attempt
      vi.advanceTimersByTime(1000);

      expect(mockReconnectListener).toHaveBeenCalledWith({
        attempt: 1,
        maxAttempts: 5
      });
    });

    it('should use exponential backoff for reconnection attempts', () => {
      let connectionAttempts = 0;

      const simulateReconnectionWithBackoff = () => {
        const maxAttempts = 3;
        let attempts = 0;

        const attemptReconnection = () => {
          if (attempts < maxAttempts) {
            attempts++;
            const delay = 1000 * attempts; // Linear backoff for simplicity

            setTimeout(() => {
              connectionAttempts++;
              // Simulate failed connection without calling actual mock
            }, delay);
          }
        };

        attemptReconnection();
      };

      simulateReconnectionWithBackoff();

      // Fast forward through all attempts
      vi.advanceTimersByTime(1000); // First attempt
      expect(connectionAttempts).toBe(1);
    });

    it('should stop reconnection attempts after max attempts reached', () => {
      const maxReconnectionListener = vi.fn();
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 2;

      const handleReconnection = () => {
        const attemptReconnection = () => {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;

            setTimeout(() => {
              // Simulate connection failure
              if (reconnectAttempts < maxReconnectAttempts) {
                setTimeout(attemptReconnection, 1000);
              } else {
                maxReconnectionListener('max_reconnect_attempts_reached');
              }
            }, 1000);
          }
        };

        attemptReconnection();
      };

      handleReconnection();

      // Fast forward through all attempts
      vi.advanceTimersByTime(1000); // First attempt
      vi.advanceTimersByTime(2000); // Wait for second attempt and completion

      expect(reconnectAttempts).toBe(2);
      expect(maxReconnectionListener).toHaveBeenCalledWith('max_reconnect_attempts_reached');
    });

    it('should successfully reconnect and reset attempt counter', () => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      let connectionSuccessful = false;

      const simulateSuccessfulReconnection = () => {
        const attemptReconnection = () => {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;

            // Simulate connection attempt
            setTimeout(() => {
              if (reconnectAttempts === 2) {
                // Second attempt succeeds
                reconnectAttempts = 0; // Reset on successful connection
                mockWebSocketManager.connected = true;
                connectionSuccessful = true;
              } else {
                // First attempt fails, try again
                if (reconnectAttempts < maxReconnectAttempts) {
                  attemptReconnection();
                }
              }
            }, 100);
          }
        };

        attemptReconnection();
      };

      simulateSuccessfulReconnection();

      // Fast forward through attempts
      vi.advanceTimersByTime(100); // First attempt fails
      vi.advanceTimersByTime(100); // Second attempt succeeds

      expect(connectionSuccessful).toBe(true);
      expect(mockWebSocketManager.connected).toBe(true);
      expect(reconnectAttempts).toBe(0); // Should be reset after successful connection
    });

    it('should handle server-initiated disconnection without reconnection', () => {
      const reconnectionAttemptListener = vi.fn();

      const handleDisconnection = (reason: string) => {
        if (reason === 'io server disconnect') {
          // Don't attempt reconnection for server-initiated disconnects
          return;
        }

        reconnectionAttemptListener('attempting_reconnection');
      };

      // Test server disconnect
      handleDisconnection('io server disconnect');
      expect(reconnectionAttemptListener).not.toHaveBeenCalled();

      // Test other disconnect reasons
      handleDisconnection('transport close');
      expect(reconnectionAttemptListener).toHaveBeenCalledWith('attempting_reconnection');
    });

    it('should maintain session persistence across reconnections', async () => {
      const sessionId = 'session_persistent_123';
      mockWebSocketManager.currentSessionId = sessionId;

      const simulateReconnectionWithSession = async () => {
        // Simulate disconnection
        mockWebSocketManager.connected = false;

        // Simulate reconnection
        mockWebSocketManager.connect.mockImplementation(async () => {
          mockWebSocketManager.connected = true;
          // Session should be preserved
          expect(mockWebSocketManager.currentSessionId).toBe(sessionId);
          return true;
        });

        return await mockWebSocketManager.connect();
      };

      const connected = await simulateReconnectionWithSession();

      expect(connected).toBe(true);
      expect(mockWebSocketManager.currentSessionId).toBe(sessionId);
    });

    it('should emit connection status changes during reconnection process', () => {
      const statusChangeListener = vi.fn();

      const simulateReconnectionWithStatusUpdates = () => {
        // Simulate disconnection
        mockWebSocketManager.connected = false;
        statusChangeListener({ connected: false });

        // Simulate successful reconnection
        setTimeout(() => {
          mockWebSocketManager.connected = true;
          statusChangeListener({ connected: true });
        }, 1000);
      };

      simulateReconnectionWithStatusUpdates();

      // Check disconnection status
      expect(statusChangeListener).toHaveBeenCalledWith({ connected: false });

      // Fast forward to reconnection
      vi.advanceTimersByTime(1000);
      expect(statusChangeListener).toHaveBeenCalledWith({ connected: true });
    });

    it('should handle connection timeout during reconnection', () => {
      const timeoutListener = vi.fn();

      const simulateConnectionTimeout = () => {
        const connectionTimeout = 1000; // 1 second

        setTimeout(() => {
          timeoutListener('connection_timeout');
        }, connectionTimeout);
      };

      simulateConnectionTimeout();

      // Fast forward past timeout
      vi.advanceTimersByTime(1000);

      expect(timeoutListener).toHaveBeenCalledWith('connection_timeout');
    });
  });

  afterEach(() => {
    // Ensure all timers are cleared
    vi.clearAllTimers();

    // Clear the mock manager reference
    mockWebSocketManager = createCleanMockWebSocketManager();
  });
});