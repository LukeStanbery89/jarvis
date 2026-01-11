// Raw WebSocket implementation
import {
    BaseMessage,
    ChatMessage,
    AgentResponse,
    AgentStatus,
    ClientRegistration
} from '@jarvis/protocol';
import { ToolExecutor } from './tools/ToolExecutor';

export class WebSocketManager {
    private socket: WebSocket | null = null;
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private serverUrl: string;
    private eventListeners: Map<string, Function[]> = new Map();

    // Add session management
    private currentSessionId: string | null = null;
    private readonly SESSION_STORAGE_KEY = 'chatSessionId';

    // Connection polling management
    private connectionPollInterval: number | null = null;
    private lastConnectionCheck: number = 0;
    private readonly CONNECTED_POLL_INTERVAL = 30000; // 30 seconds when connected
    private readonly DISCONNECTED_POLL_INTERVAL = 5000; // 5 seconds when disconnected

    // FIXME: Memory management improvements needed:
    // - Implement session timeout/cleanup mechanism
    // - Add conversation length limits to prevent unbounded growth
    // - Handle background script restart scenarios gracefully
    // - Consider implementing periodic context summarization
    // - Add session health monitoring and recovery

    private readonly SERVER_URL_KEY = 'jarvis_server_url';
    private readonly DEFAULT_SERVER_URL = 'ws://127.0.0.1:3000';

    constructor(serverUrl = 'ws://127.0.0.1:3000') {
        this.serverUrl = serverUrl;
        this.loadStoredSessionId(); // Load session on startup
        this.loadServerUrl(); // Load server URL from settings
        // Don't start polling immediately - let the background script handle initial connection
    }

    /**
     * Load server URL from storage
     */
    private async loadServerUrl(): Promise<void> {
        try {
            const result = await chrome.storage.local.get([this.SERVER_URL_KEY]);
            if (result[this.SERVER_URL_KEY]) {
                this.serverUrl = result[this.SERVER_URL_KEY];
                console.log('[WebSocket] Loaded server URL from storage:', this.serverUrl);
            }
        } catch (error) {
            console.error('[WebSocket] Failed to load server URL:', error);
        }
    }

    /**
     * Update server URL and reconnect
     */
    public async updateServerUrl(newUrl: string): Promise<void> {
        if (this.serverUrl === newUrl) {
            console.log('[WebSocket] Server URL unchanged, skipping reconnect');
            return;
        }

        console.log('[WebSocket] Updating server URL from', this.serverUrl, 'to', newUrl);
        this.serverUrl = newUrl;

        // Disconnect from old server
        if (this.isConnected) {
            this.disconnect();
        }

        // Reconnect to new server
        try {
            await this.connect();
        } catch (error) {
            console.error('[WebSocket] Failed to reconnect with new URL:', error);
        }
    }

    // Connection polling methods
    private startConnectionPolling(): void {
        this.stopConnectionPolling(); // Clear any existing polling
        this.scheduleNextPoll();
    }

    private stopConnectionPolling(): void {
        if (this.connectionPollInterval) {
            clearTimeout(this.connectionPollInterval);
            this.connectionPollInterval = null;
        }
    }

    private scheduleNextPoll(): void {
        const interval = this.isConnected ?
            this.CONNECTED_POLL_INTERVAL :
            this.DISCONNECTED_POLL_INTERVAL;

        this.connectionPollInterval = setTimeout(() => {
            this.performConnectionCheck();
        }, interval);
    }

    private async performConnectionCheck(): Promise<void> {
        this.lastConnectionCheck = Date.now();

        try {
            if (!this.isConnected || !this.socket) {
                // Try to reconnect if not connected
                console.log('[WebSocket] Performing connection check - attempting to connect');
                await this.connect();
            } else {
                // Send a ping to check connection health
                this.sendPing();
            }
        } catch (error) {
            console.error('[WebSocket] Connection check failed:', error);
        } finally {
            // Schedule next poll regardless of outcome
            this.scheduleNextPoll();
        }
    }

    private sendPing(): void {
        if (this.socket && this.isConnected) {
            // Send a lightweight ping message that doesn't invoke LLM
            const pingMessage = {
                id: this.generateMessageId(),
                type: 'ping',
                timestamp: Date.now()
            };

            console.log('[WebSocket] Sending ping to check connection');
            this.socket.send(JSON.stringify(pingMessage));

            // Reset the last connection check time since we just made a request
            this.lastConnectionCheck = Date.now();
        }
    }

    public resetConnectionCheckTimer(): void {
        // Called whenever a WebSocket request is made
        this.lastConnectionCheck = Date.now();

        // Restart the polling timer since we just confirmed connectivity
        this.stopConnectionPolling();
        this.scheduleNextPoll();
    }

    // Create tool executor instance for capability detection
    private static getToolCapabilities(): string[] {
        const toolExecutor = new ToolExecutor();
        return toolExecutor.getCapabilities();
    }

    // Load session ID from storage
    private async loadStoredSessionId(): Promise<void> {
        try {
            const result = await chrome.storage.local.get([this.SESSION_STORAGE_KEY]);
            if (result[this.SESSION_STORAGE_KEY]) {
                this.currentSessionId = result[this.SESSION_STORAGE_KEY];
                console.log('Loaded stored session ID:', this.currentSessionId);
            }
        } catch (error) {
            console.error('Failed to load session ID:', error);
        }
    }

    // Save session ID to storage
    private async saveSessionId(): Promise<void> {
        if (!this.currentSessionId) return;
        
        try {
            await chrome.storage.local.set({
                [this.SESSION_STORAGE_KEY]: this.currentSessionId
            });
            console.log('Saved session ID:', this.currentSessionId);
        } catch (error) {
            console.error('Failed to save session ID:', error);
        }
    }

    // Create new session
    public async createNewSession(): Promise<void> {
        this.currentSessionId = this.generateSessionId();
        await this.saveSessionId();
        console.log('Created new session:', this.currentSessionId);
    }

    // Clear current session
    public async clearSession(): Promise<void> {
        try {
            // Send clear conversation request to server if connected
            if (this.socket && this.isConnected) {
                const clearMessage = {
                    id: this.generateMessageId(),
                    type: 'clear_conversation',
                    timestamp: Date.now(),
                    clientId: this.socket.id,
                    sessionId: this.currentSessionId // Send the session ID being cleared
                };
                
                console.log('Sending clear conversation request to server for session:', this.currentSessionId);
                this.socket.send(JSON.stringify(clearMessage));
            }
            
            // Clear local session
            this.currentSessionId = null;
            await chrome.storage.local.remove([this.SESSION_STORAGE_KEY]);
            console.log('Cleared session');
        } catch (error) {
            console.error('Failed to clear session:', error);
        }
    }

    // Connect to the WebSocket server
    public async connect(): Promise<boolean> {
        try {
            // Clean up any existing socket first
            if (this.socket) {
                this.socket.close();
            }

            this.socket = new WebSocket(this.serverUrl);

            this.setupEventHandlers();

            return new Promise((resolve, reject) => {
                if (!this.socket) {
                    reject(new Error('Socket not initialized'));
                    return;
                }

                this.socket.onopen = () => {
                    console.log('WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.registerClient();
                    this.startConnectionPolling(); // Start polling after successful connection
                    this.emit('connection_status_changed', { connected: true });
                    resolve(true);
                };

                this.socket.onerror = (error) => {
                    console.error('WebSocket connection error:', error);
                    this.isConnected = false;
                    this.startConnectionPolling(); // Start polling after connection failure to retry
                    this.emit('connection_status_changed', { connected: false });
                    reject(error);
                };

                // Set timeout for connection
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.startConnectionPolling(); // Start polling after timeout to retry
                        this.emit('connection_status_changed', { connected: false });
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);
            });
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            return false;
        }
    }

    // Register this browser extension client with the server
    private async registerClient() {
        if (!this.socket || !this.isConnected) {
            console.error('Cannot register client: not connected');
            return;
        }

        const registration: ClientRegistration = {
            id: this.generateMessageId(),
            type: 'client_registration',
            timestamp: Date.now(),
            clientType: 'browser_extension',
            capabilities: WebSocketManager.getToolCapabilities(),
            userAgent: navigator.userAgent,
            metadata: {
                extensionVersion: chrome.runtime.getManifest().version,
                browserName: this.getBrowserName()
            }
        };

        console.log('Registering browser extension client:', registration);
        this.socket.send(JSON.stringify(registration));
    }

    // Setup event handlers for WebSocket events
    private setupEventHandlers() {
        if (!this.socket) return;

        this.socket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.resetConnectionCheckTimer(); // Reset polling to disconnected interval
            this.emit('connection_status_changed', { connected: false });
            this.handleDisconnection(event.reason || 'Unknown');
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received message:', data.type, data);

                switch (data.type) {
                    case 'registration_confirmed':
                        console.log('Client registration confirmed:', data);
                        this.emit('registration_confirmed', data);
                        break;
                    case 'agent_response':
                        console.log('Received agent response:', data);
                        this.emit('agent_response', data);
                        break;
                    case 'agent_status':
                        console.log('Agent status update:', data);
                        this.emit('agent_status', data);
                        break;
                    case 'conversation_cleared':
                        console.log('Server confirmed conversation cleared:', data);
                        this.emit('conversation_cleared', data);
                        break;
                    case 'tool_execution_request':
                        console.log('Received tool execution request:', data);
                        this.emit('tool_execution_request', data);
                        break;
                    case 'tool_execution_status':
                        console.log('Received tool execution status:', data);
                        this.emit('tool_execution_status', data);
                        break;
                    case 'pong':
                        console.log('Received pong response:', data);
                        // Pong received - connection is healthy
                        break;
                    case 'error':
                        console.error('WebSocket error:', data);
                        this.emit('error', data);
                        break;
                    default:
                        console.warn('Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
    }

    // Send chat message to server
    public async sendChatMessage(content: string): Promise<void> {
        if (!this.socket || !this.isConnected) {
            console.error('Cannot send message: not connected');
            return;
        }

        // Create session if none exists
        if (!this.currentSessionId) {
            await this.createNewSession();
        }

        const message: ChatMessage = {
            id: this.generateMessageId(),
            type: 'chat_message',
            timestamp: Date.now(),
            content,
            sessionId: this.currentSessionId!
        };

        console.log('Sending chat message with session:', message.sessionId);
        this.socket.send(JSON.stringify(message));

        // Reset connection check timer since we just made a WebSocket request
        this.resetConnectionCheckTimer();
    }

    // Send arbitrary message to server
    public sendMessage(eventName: string, data: any): void {
        if (!this.socket || !this.isConnected) {
            console.error('Cannot send message: not connected');
            return;
        }

        console.log('Sending message to server:', eventName, data);
        this.socket.send(JSON.stringify({ ...data, type: eventName }));

        // Reset connection check timer since we just made a WebSocket request
        this.resetConnectionCheckTimer();
    }

    // Handle disconnection and attempt reconnection
    private async handleDisconnection(reason: string) {
        if (reason === 'io server disconnect') {
            // Server disconnected, don't try to reconnect
            console.log('Server disconnected, not attempting reconnection');
            return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            setTimeout(() => {
                this.connect().catch(error => {
                    console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('max_reconnect_attempts_reached');
        }
    }

    // Event system for the WebSocket manager
    public on(event: string, listener: Function): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(listener);
    }

    public off(event: string, listener?: Function): void {
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

    private emit(event: string, data?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Utility methods
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private getBrowserName(): string {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'chrome';
        if (userAgent.includes('Firefox')) return 'firefox';
        if (userAgent.includes('Safari')) return 'safari';
        if (userAgent.includes('Edge')) return 'edge';
        return 'unknown';
    }

    // Public getters
    public get connected(): boolean {
        return this.isConnected;
    }

    public get socketId(): string | undefined {
        return this.socket ? 'websocket-client' : undefined;
    }

    public getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    // Disconnect
    public disconnect(): void {
        this.stopConnectionPolling(); // Stop polling when disconnecting
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.eventListeners.clear();
    }
}

// Singleton instance for use across the extension
export const websocketManager = new WebSocketManager();