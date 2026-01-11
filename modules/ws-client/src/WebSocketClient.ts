import {
    BaseMessage,
    ChatMessage,
    AgentResponse,
    AgentStatus,
    ClientRegistration
} from '@jarvis/protocol';
import { IDeviceIdentity, IStorageAdapter } from '@jarvis/device-identity';
import {
    IWebSocketClient,
    IWebSocketClientConfig,
    IWebSocketClientDependencies,
    EventListener
} from './types';

/**
 * WebSocket client with reconnection, heartbeat, and session management.
 * Platform-agnostic implementation that works in both browser and Node.js environments.
 */
export class WebSocketClient implements IWebSocketClient {
    // Constants
    private static readonly DEFAULT_SERVER_URL = 'ws://192.168.86.52:3000';
    private static readonly DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
    private static readonly DEFAULT_RECONNECT_DELAY = 1000;
    private static readonly DEFAULT_CONNECTED_POLL_INTERVAL = 30_000; // 30 seconds
    private static readonly DEFAULT_DISCONNECTED_POLL_INTERVAL = 5_000; // 5 seconds
    private static readonly CONNECTION_TIMEOUT_MS = 10_000; // 10 seconds
    private static readonly SESSION_STORAGE_KEY = 'chatSessionId';

    // WebSocket close codes
    private static readonly CLOSE_NORMAL = 1000;
    private static readonly CLOSE_GOING_AWAY = 1001;

    // WebSocket connection
    private socket: WebSocket | null = null;
    private isConnected = false;
    private reconnectAttempts = 0;
    private connectionTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    // Configuration
    private readonly maxReconnectAttempts: number;
    private readonly reconnectDelay: number;
    private readonly serverUrl: string;
    private readonly connectedPollInterval: number;
    private readonly disconnectedPollInterval: number;

    // Dependencies
    private readonly deviceIdentity: IDeviceIdentity;
    private readonly storage: IStorageAdapter;
    private readonly capabilities: string[];

    // Session management
    private currentSessionId: string | null = null;

    // Connection polling management
    private connectionPollInterval: ReturnType<typeof setTimeout> | null = null;
    private lastConnectionCheck: number = 0;

    // Event system
    private eventListeners: Map<string, EventListener[]> = new Map();

    constructor(
        dependencies: IWebSocketClientDependencies,
        config?: IWebSocketClientConfig
    ) {
        // Store dependencies
        this.deviceIdentity = dependencies.deviceIdentity;
        this.storage = dependencies.storage;
        this.capabilities = dependencies.capabilities;

        // Apply configuration with defaults
        this.serverUrl = config?.serverUrl ?? WebSocketClient.DEFAULT_SERVER_URL;
        this.maxReconnectAttempts = config?.maxReconnectAttempts ?? WebSocketClient.DEFAULT_MAX_RECONNECT_ATTEMPTS;
        this.reconnectDelay = config?.reconnectDelay ?? WebSocketClient.DEFAULT_RECONNECT_DELAY;
        this.connectedPollInterval = config?.connectedPollInterval ?? WebSocketClient.DEFAULT_CONNECTED_POLL_INTERVAL;
        this.disconnectedPollInterval = config?.disconnectedPollInterval ?? WebSocketClient.DEFAULT_DISCONNECTED_POLL_INTERVAL;

        // Load stored session on startup
        this.loadStoredSessionId().catch(error => {
            console.error('[WebSocketClient] Failed to load stored session on startup:', error);
        });

        // Auto-connect if configured
        if (config?.autoConnect) {
            this.connect().catch(error => {
                console.error('[WebSocketClient] Auto-connect failed:', error);
            });
        }
    }

    // ========== Connection Lifecycle ==========

    /**
     * Connect to the WebSocket server
     */
    public async connect(): Promise<boolean> {
        try {
            // Clean up any existing socket first
            if (this.socket) {
                this.cleanupSocket();
            }

            this.socket = new WebSocket(this.serverUrl);

            return new Promise((resolve, reject) => {
                if (!this.socket) {
                    reject(new Error('Socket not initialized'));
                    return;
                }

                // Use one-time event listeners for connection promise
                const handleOpen = () => {
                    if (this.connectionTimeoutHandle) {
                        clearTimeout(this.connectionTimeoutHandle);
                        this.connectionTimeoutHandle = null;
                    }
                    console.log('[WebSocketClient] Connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;

                    // Now setup persistent event handlers
                    this.setupEventHandlers();

                    // Register client and start polling
                    this.registerClient().catch(error => {
                        console.error('[WebSocketClient] Client registration failed:', error);
                    });
                    this.startConnectionPolling();
                    this.emit('connection_status_changed', { connected: true });
                    resolve(true);
                };

                const handleError = (error: Event) => {
                    if (this.connectionTimeoutHandle) {
                        clearTimeout(this.connectionTimeoutHandle);
                        this.connectionTimeoutHandle = null;
                    }
                    console.error('[WebSocketClient] Connection error:', error);
                    this.isConnected = false;
                    this.startConnectionPolling();
                    this.emit('connection_status_changed', { connected: false });
                    reject(error);
                };

                // Set one-time connection listeners
                this.socket.addEventListener('open', handleOpen, { once: true });
                this.socket.addEventListener('error', handleError, { once: true });

                // Set timeout for connection
                this.connectionTimeoutHandle = setTimeout(() => {
                    if (!this.isConnected && this.socket) {
                        this.socket.removeEventListener('open', handleOpen);
                        this.socket.removeEventListener('error', handleError);
                        this.startConnectionPolling();
                        this.emit('connection_status_changed', { connected: false });
                        reject(new Error('Connection timeout'));
                    }
                }, WebSocketClient.CONNECTION_TIMEOUT_MS);
            });
        } catch (error) {
            console.error('[WebSocketClient] Failed to connect:', error);
            return false;
        }
    }

    /**
     * Disconnect from the WebSocket server
     */
    public disconnect(): void {
        this.stopConnectionPolling();
        this.cleanupSocket();
        this.isConnected = false;
        this.eventListeners.clear();
    }

    /**
     * Clean up WebSocket and all its event handlers
     */
    private cleanupSocket(): void {
        if (this.socket) {
            // Remove all event handlers to prevent memory leaks
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;

            // Close the socket
            this.socket.close();
            this.socket = null;
        }

        // Clear connection timeout if exists
        if (this.connectionTimeoutHandle) {
            clearTimeout(this.connectionTimeoutHandle);
            this.connectionTimeoutHandle = null;
        }
    }

    /**
     * Handle disconnection and attempt reconnection
     */
    private async handleDisconnection(code: number, reason: string): Promise<void> {
        // Check if server disconnected cleanly (normal closure or going away)
        if (code === WebSocketClient.CLOSE_NORMAL || code === WebSocketClient.CLOSE_GOING_AWAY) {
            console.log('[WebSocketClient] Server disconnected cleanly, not attempting reconnection');
            return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WebSocketClient] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            setTimeout(() => {
                this.connect().catch(error => {
                    console.error(`[WebSocketClient] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
                    // Recursively handle disconnection to attempt next reconnect or emit max attempts
                    this.handleDisconnection(1006, 'Reconnection failed');
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('[WebSocketClient] Max reconnection attempts reached');
            this.emit('max_reconnect_attempts_reached');
        }
    }

    // ========== Session Management ==========

    /**
     * Create a new session
     */
    public async createNewSession(): Promise<void> {
        this.currentSessionId = this.generateSessionId();
        try {
            await this.saveSessionId();
            console.log('[WebSocketClient] Created new session:', this.currentSessionId);
        } catch (error) {
            this.currentSessionId = null;
            console.error('[WebSocketClient] Failed to save new session:', error);
            throw new Error('Failed to create session');
        }
    }

    /**
     * Clear the current session
     */
    public async clearSession(): Promise<void> {
        try {
            // Send clear conversation request to server if connected
            if (this.socket && this.isConnected) {
                const clearMessage = {
                    id: this.generateMessageId(),
                    type: 'clear_conversation',
                    timestamp: Date.now(),
                    clientId: this.socketId,
                    sessionId: this.currentSessionId
                };

                console.log('[WebSocketClient] Sending clear conversation request for session:', this.currentSessionId);
                this.socket.send(JSON.stringify(clearMessage));
            }

            // Clear local session
            this.currentSessionId = null;
            await this.storage.remove(WebSocketClient.SESSION_STORAGE_KEY);
            console.log('[WebSocketClient] Cleared session');
        } catch (error) {
            console.error('[WebSocketClient] Failed to clear session:', error);
        }
    }

    /**
     * Get the current session ID
     */
    public getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Load session ID from storage
     */
    private async loadStoredSessionId(): Promise<void> {
        try {
            const sessionId = await this.storage.get(WebSocketClient.SESSION_STORAGE_KEY);
            if (sessionId) {
                this.currentSessionId = sessionId;
                console.log('[WebSocketClient] Loaded stored session ID:', this.currentSessionId);
            }
        } catch (error) {
            console.error('[WebSocketClient] Failed to load session ID:', error);
        }
    }

    /**
     * Save session ID to storage
     */
    private async saveSessionId(): Promise<void> {
        if (!this.currentSessionId) return;

        await this.storage.set(WebSocketClient.SESSION_STORAGE_KEY, this.currentSessionId);
        console.log('[WebSocketClient] Saved session ID:', this.currentSessionId);
    }

    // ========== Health Monitoring ==========

    /**
     * Start connection polling
     */
    private startConnectionPolling(): void {
        this.stopConnectionPolling();
        this.scheduleNextPoll();
    }

    /**
     * Stop connection polling
     */
    private stopConnectionPolling(): void {
        if (this.connectionPollInterval) {
            clearTimeout(this.connectionPollInterval);
            this.connectionPollInterval = null;
        }
    }

    /**
     * Schedule next poll based on connection state
     */
    private scheduleNextPoll(): void {
        const interval = this.isConnected ?
            this.connectedPollInterval :
            this.disconnectedPollInterval;

        this.connectionPollInterval = setTimeout(() => {
            this.performConnectionCheck();
        }, interval);
    }

    /**
     * Perform connection health check
     */
    private async performConnectionCheck(): Promise<void> {
        this.lastConnectionCheck = Date.now();

        try {
            if (!this.isConnected || !this.socket) {
                console.log('[WebSocketClient] Performing connection check - attempting to connect');
                await this.connect();
            } else {
                this.sendPing();
            }
        } catch (error) {
            console.error('[WebSocketClient] Connection check failed:', error);
        } finally {
            this.scheduleNextPoll();
        }
    }

    /**
     * Send ping to check connection health
     */
    private sendPing(): void {
        if (this.socket && this.isConnected) {
            const pingMessage = {
                id: this.generateMessageId(),
                type: 'ping',
                timestamp: Date.now()
            };

            console.log('[WebSocketClient] Sending ping to check connection');
            this.socket.send(JSON.stringify(pingMessage));
            this.lastConnectionCheck = Date.now();
        }
    }

    /**
     * Reset connection check timer (called after sending messages)
     */
    public resetConnectionCheckTimer(): void {
        this.lastConnectionCheck = Date.now();
        this.stopConnectionPolling();
        this.scheduleNextPoll();
    }

    // ========== Messaging ==========

    /**
     * Send chat message to server
     */
    public async sendChatMessage(content: string): Promise<void> {
        if (!this.socket || !this.isConnected) {
            console.error('[WebSocketClient] Cannot send message: not connected');
            throw new Error('Cannot send message: not connected');
        }

        // Create session if none exists
        if (!this.currentSessionId) {
            await this.createNewSession();
        }

        // Verify session was created successfully
        if (!this.currentSessionId) {
            throw new Error('Failed to create session - cannot send message');
        }

        const message: ChatMessage = {
            id: this.generateMessageId(),
            type: 'chat_message',
            timestamp: Date.now(),
            content,
            sessionId: this.currentSessionId
        };

        console.log('[WebSocketClient] Sending chat message with session:', message.sessionId);
        this.socket.send(JSON.stringify(message));
        this.resetConnectionCheckTimer();
    }

    /**
     * Send arbitrary message to server
     */
    public sendMessage(eventName: string, data: any): void {
        if (!this.socket || !this.isConnected) {
            console.error('[WebSocketClient] Cannot send message: not connected');
            return;
        }

        console.log('[WebSocketClient] Sending message to server:', eventName, data);
        this.socket.send(JSON.stringify({ ...data, type: eventName }));
        this.resetConnectionCheckTimer();
    }

    /**
     * Register this client with the server
     */
    private async registerClient(): Promise<void> {
        if (!this.socket || !this.isConnected) {
            console.error('[WebSocketClient] Cannot register client: not connected');
            return;
        }

        const registration: ClientRegistration = {
            id: this.generateMessageId(),
            type: 'client_registration',
            timestamp: Date.now(),
            clientType: this.deviceIdentity.deviceType,
            capabilities: this.capabilities,
            userAgent: this.deviceIdentity.metadata.userAgent ?? 'unknown',
            metadata: {
                ...this.deviceIdentity.metadata,
                deviceId: this.deviceIdentity.deviceId,
                deviceType: this.deviceIdentity.deviceType
            }
        };

        console.log('[WebSocketClient] Registering client:', registration);
        this.socket.send(JSON.stringify(registration));
    }

    /**
     * Setup event handlers for WebSocket events
     */
    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.onclose = (event) => {
            console.log('[WebSocketClient] Disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.resetConnectionCheckTimer();
            this.emit('connection_status_changed', { connected: false });
            this.handleDisconnection(event.code, event.reason || 'Unknown');
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[WebSocketClient] Received message:', data.type, data);

                switch (data.type) {
                    case 'registration_confirmed':
                        console.log('[WebSocketClient] Client registration confirmed:', data);
                        this.emit('registration_confirmed', data);
                        break;
                    case 'agent_response':
                        console.log('[WebSocketClient] Received agent response:', data);
                        this.emit('agent_response', data);
                        break;
                    case 'agent_status':
                        console.log('[WebSocketClient] Agent status update:', data);
                        this.emit('agent_status', data);
                        break;
                    case 'conversation_cleared':
                        console.log('[WebSocketClient] Server confirmed conversation cleared:', data);
                        this.emit('conversation_cleared', data);
                        break;
                    case 'tool_execution_request':
                        console.log('[WebSocketClient] Received tool execution request:', data);
                        this.emit('tool_execution_request', data);
                        break;
                    case 'tool_execution_status':
                        console.log('[WebSocketClient] Received tool execution status:', data);
                        this.emit('tool_execution_status', data);
                        break;
                    case 'pong':
                        console.log('[WebSocketClient] Received pong response:', data);
                        break;
                    case 'error':
                        console.error('[WebSocketClient] WebSocket error:', data);
                        this.emit('error', data);
                        break;
                    default:
                        console.warn('[WebSocketClient] Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('[WebSocketClient] Failed to parse WebSocket message:', error);
            }
        };
    }

    // ========== Event System ==========

    /**
     * Register an event listener
     */
    public on(event: string, listener: EventListener): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    /**
     * Remove an event listener
     */
    public off(event: string, listener?: EventListener): void {
        if (!this.eventListeners.has(event)) return;

        if (listener) {
            const listeners = this.eventListeners.get(event)!;
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        } else {
            this.eventListeners.delete(event);
        }
    }

    /**
     * Emit an event to all registered listeners
     */
    private emit(event: string, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`[WebSocketClient] Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // ========== Utility Methods ==========

    /**
     * Generate a unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // ========== Public Getters ==========

    /**
     * Check if the client is connected
     */
    public get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Get the socket ID (uses device ID for uniqueness)
     */
    public get socketId(): string | undefined {
        return this.socket ? this.deviceIdentity.deviceId : undefined;
    }
}
