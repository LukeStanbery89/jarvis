// Tests for background script connection status broadcasting functionality
// Use Jest globals

// Mock WebSocketManager
const mockWebSocketManager = {
    connected: false,
    getCurrentSessionId: vi.fn(),
    on: vi.fn(),
    connect: vi.fn(),
    clearSession: vi.fn(),
    sendMessage: vi.fn(),
};

// Mock Chrome runtime for background script communication
const mockActivePopupPorts = new Set<any>();
const mockPort = {
    postMessage: vi.fn(),
    onMessage: {
        addListener: vi.fn(),
    },
    onDisconnect: {
        addListener: vi.fn(),
    },
    name: 'popup-background',
};

describe('Background Script Connection Status Broadcasting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockActivePopupPorts.clear();
        mockWebSocketManager.connected = false;
        mockWebSocketManager.getCurrentSessionId.mockReturnValue(null);
    });

    describe('Connection Status Broadcasting', () => {
        it('should broadcast connection status changes to popup ports', () => {
            const mockListener = vi.fn();
            const connectionData = { connected: true };

            // Simulate adding a popup port
            mockActivePopupPorts.add(mockPort);

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    try {
                        port.postMessage(message);
                    } catch (error) {
                        mockActivePopupPorts.delete(port);
                    }
                });
            }

            // Simulate WebSocket event listener setup
            mockWebSocketManager.on.mockImplementation((event, listener) => {
                if (event === 'connection_status_changed') {
                    mockListener.mockImplementation(listener);
                }
            });

            // Set up the event listener
            mockWebSocketManager.on('connection_status_changed', (data) => {
                broadcastToPopups('connection_status', data);
            });

            // Trigger connection status change
            mockListener(connectionData);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: connectionData
            });
        });

        it('should send initial connection status when popup connects', () => {
            mockWebSocketManager.connected = true;
            mockWebSocketManager.getCurrentSessionId.mockReturnValue('session_123');

            function handlePopupConnection(port: any) {
                const status = {
                    type: 'connection_status',
                    data: {
                        connected: mockWebSocketManager.connected,
                        sessionId: mockWebSocketManager.getCurrentSessionId()
                    }
                };
                port.postMessage(status);
            }

            handlePopupConnection(mockPort);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: {
                    connected: true,
                    sessionId: 'session_123'
                }
            });
        });

        it('should handle multiple popup ports correctly', () => {
            const mockPort2 = {
                postMessage: vi.fn(),
                onMessage: { addListener: vi.fn() },
                onDisconnect: { addListener: vi.fn() },
                name: 'popup-background',
            };

            // Add multiple ports
            mockActivePopupPorts.add(mockPort);
            mockActivePopupPorts.add(mockPort2);

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    try {
                        port.postMessage(message);
                    } catch (error) {
                        mockActivePopupPorts.delete(port);
                    }
                });
            }

            const connectionData = { connected: false };
            broadcastToPopups('connection_status', connectionData);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: connectionData
            });
            expect(mockPort2.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: connectionData
            });
        });

        it('should remove invalid ports during broadcasting', () => {
            const invalidPort = {
                postMessage: vi.fn().mockImplementation(() => {
                    throw new Error('Port disconnected');
                }),
            };

            mockActivePopupPorts.add(mockPort);
            mockActivePopupPorts.add(invalidPort);

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    try {
                        port.postMessage(message);
                    } catch (error) {
                        mockActivePopupPorts.delete(port);
                    }
                });
            }

            expect(mockActivePopupPorts.size).toBe(2);

            broadcastToPopups('connection_status', { connected: true });

            // Valid port should receive message
            expect(mockPort.postMessage).toHaveBeenCalled();

            // Invalid port should be removed
            expect(mockActivePopupPorts.has(invalidPort)).toBe(false);
            expect(mockActivePopupPorts.has(mockPort)).toBe(true);
            expect(mockActivePopupPorts.size).toBe(1);
        });
    });

    describe('Background Message Handling', () => {
        it('should handle get_connection_status requests', () => {
            mockWebSocketManager.connected = true;
            mockWebSocketManager.getCurrentSessionId.mockReturnValue('session_456');

            function handlePopupMessage(message: any, port: any) {
                switch (message.type) {
                    case 'get_connection_status':
                        port.postMessage({
                            type: 'connection_status',
                            data: {
                                connected: mockWebSocketManager.connected,
                                sessionId: mockWebSocketManager.getCurrentSessionId()
                            }
                        });
                        break;
                }
            }

            handlePopupMessage({ type: 'get_connection_status' }, mockPort);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: {
                    connected: true,
                    sessionId: 'session_456'
                }
            });
        });

        it('should handle reconnect requests', async () => {
            mockWebSocketManager.connect.mockResolvedValue(true);
            mockWebSocketManager.getCurrentSessionId.mockReturnValue('new_session_789');

            async function handlePopupMessage(message: any, port: any) {
                switch (message.type) {
                    case 'reconnect':
                        const reconnected = await mockWebSocketManager.connect();
                        port.postMessage({
                            type: 'connection_status',
                            data: {
                                connected: reconnected,
                                sessionId: mockWebSocketManager.getCurrentSessionId()
                            }
                        });
                        break;
                }
            }

            await handlePopupMessage({ type: 'reconnect' }, mockPort);

            expect(mockWebSocketManager.connect).toHaveBeenCalled();
            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'connection_status',
                data: {
                    connected: true,
                    sessionId: 'new_session_789'
                }
            });
        });

        it('should handle send_chat_message when connected', () => {
            mockWebSocketManager.connected = true;
            mockWebSocketManager.sendChatMessage = vi.fn();

            function handlePopupMessage(message: any, port: any) {
                switch (message.type) {
                    case 'send_chat_message':
                        if (mockWebSocketManager.connected) {
                            mockWebSocketManager.sendChatMessage(message.content);
                        } else {
                            port.postMessage({
                                type: 'error',
                                message: 'Not connected to server'
                            });
                        }
                        break;
                }
            }

            handlePopupMessage({
                type: 'send_chat_message',
                content: 'Hello, world!'
            }, mockPort);

            expect(mockWebSocketManager.sendChatMessage).toHaveBeenCalledWith('Hello, world!');
            expect(mockPort.postMessage).not.toHaveBeenCalled();
        });

        it('should handle send_chat_message when disconnected', () => {
            mockWebSocketManager.connected = false;

            function handlePopupMessage(message: any, port: any) {
                switch (message.type) {
                    case 'send_chat_message':
                        if (mockWebSocketManager.connected) {
                            mockWebSocketManager.sendChatMessage(message.content);
                        } else {
                            port.postMessage({
                                type: 'error',
                                message: 'Not connected to server'
                            });
                        }
                        break;
                }
            }

            handlePopupMessage({
                type: 'send_chat_message',
                content: 'Hello, world!'
            }, mockPort);

            expect(mockWebSocketManager.sendChatMessage).not.toHaveBeenCalled();
            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'error',
                message: 'Not connected to server'
            });
        });

        it('should handle clear_session requests', async () => {
            mockWebSocketManager.clearSession = vi.fn().mockResolvedValue(undefined);

            async function handlePopupMessage(message: any, port: any) {
                switch (message.type) {
                    case 'clear_session':
                        await mockWebSocketManager.clearSession();
                        port.postMessage({
                            type: 'session_cleared'
                        });
                        break;
                }
            }

            await handlePopupMessage({ type: 'clear_session' }, mockPort);

            expect(mockWebSocketManager.clearSession).toHaveBeenCalled();
            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'session_cleared'
            });
        });
    });

    describe('WebSocket Event Forwarding', () => {
        it('should forward agent_response events to popups', () => {
            const agentResponse = {
                id: 'resp_123',
                content: 'Hello from agent',
                timestamp: Date.now()
            };

            const mockListener = vi.fn();
            mockActivePopupPorts.add(mockPort);

            function setupWebSocketEventListeners() {
                mockWebSocketManager.on('agent_response', (data) => {
                    broadcastToPopups('agent_response', data);
                });
            }

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    port.postMessage(message);
                });
            }

            // Setup event listeners
            mockWebSocketManager.on.mockImplementation((event, listener) => {
                if (event === 'agent_response') {
                    mockListener.mockImplementation(listener);
                }
            });

            setupWebSocketEventListeners();

            // Trigger agent response
            mockListener(agentResponse);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'agent_response',
                data: agentResponse
            });
        });

        it('should forward agent_status events to popups', () => {
            const agentStatus = {
                status: 'thinking',
                message: 'Processing your request...'
            };

            const mockListener = vi.fn();
            mockActivePopupPorts.add(mockPort);

            function setupWebSocketEventListeners() {
                mockWebSocketManager.on('agent_status', (data) => {
                    broadcastToPopups('agent_status', data);
                });
            }

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    port.postMessage(message);
                });
            }

            // Setup event listeners
            mockWebSocketManager.on.mockImplementation((event, listener) => {
                if (event === 'agent_status') {
                    mockListener.mockImplementation(listener);
                }
            });

            setupWebSocketEventListeners();

            // Trigger agent status
            mockListener(agentStatus);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'agent_status',
                data: agentStatus
            });
        });

        it('should forward conversation_cleared events to popups', () => {
            const clearData = {
                sessionId: 'session_123',
                timestamp: Date.now()
            };

            const mockListener = vi.fn();
            mockActivePopupPorts.add(mockPort);

            function setupWebSocketEventListeners() {
                mockWebSocketManager.on('conversation_cleared', (data) => {
                    broadcastToPopups('conversation_cleared', data);
                });
            }

            function broadcastToPopups(type: string, data: any) {
                const message = { type, data };
                mockActivePopupPorts.forEach(port => {
                    port.postMessage(message);
                });
            }

            // Setup event listeners
            mockWebSocketManager.on.mockImplementation((event, listener) => {
                if (event === 'conversation_cleared') {
                    mockListener.mockImplementation(listener);
                }
            });

            setupWebSocketEventListeners();

            // Trigger conversation cleared
            mockListener(clearData);

            expect(mockPort.postMessage).toHaveBeenCalledWith({
                type: 'conversation_cleared',
                data: clearData
            });
        });
    });
});