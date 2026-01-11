import { IDeviceIdentity, IStorageAdapter } from '@jarvis/device-identity';

/**
 * WebSocket client configuration options
 */
export interface IWebSocketClientConfig {
    /** WebSocket server URL. Default: 'ws://127.0.0.1:3000' */
    serverUrl?: string;
    
    /** Maximum number of reconnection attempts. Default: 5 */
    maxReconnectAttempts?: number;
    
    /** Base delay in milliseconds between reconnection attempts. Default: 1000ms */
    reconnectDelay?: number;
    
    /** Poll interval in milliseconds when connected (for health checks). Default: 30000ms (30s) */
    connectedPollInterval?: number;
    
    /** Poll interval in milliseconds when disconnected (for reconnection attempts). Default: 5000ms (5s) */
    disconnectedPollInterval?: number;
    
    /** Automatically connect on instantiation. Default: false */
    autoConnect?: boolean;
}

/**
 * WebSocket client event types
 */
export type WebSocketClientEvents = {
    'connection_status_changed': { connected: boolean };
    'registration_confirmed': any;
    'agent_response': any;
    'agent_status': any;
    'conversation_cleared': any;
    'tool_execution_request': any;
    'tool_execution_status': any;
    'error': any;
    'max_reconnect_attempts_reached': void;
};

/**
 * Event listener function type
 */
export type EventListener<T = any> = (data: T) => void;

/**
 * WebSocket client interface
 */
export interface IWebSocketClient {
    /** Connect to the WebSocket server */
    connect(): Promise<boolean>;
    
    /** Disconnect from the WebSocket server */
    disconnect(): void;
    
    /** Send a chat message to the server */
    sendChatMessage(content: string): Promise<void>;
    
    /** Send an arbitrary message to the server */
    sendMessage(eventName: string, data: any): void;
    
    /** Create a new session */
    createNewSession(): Promise<void>;
    
    /** Clear the current session */
    clearSession(): Promise<void>;
    
    /** Get the current session ID */
    getCurrentSessionId(): string | null;
    
    /** Check if the client is connected */
    get connected(): boolean;
    
    /** Get the socket ID */
    get socketId(): string | undefined;
    
    /** Register an event listener */
    on(event: string, listener: EventListener): void;
    
    /** Remove an event listener */
    off(event: string, listener?: EventListener): void;
    
    /** Reset connection check timer (called after sending messages) */
    resetConnectionCheckTimer(): void;
}

/**
 * Dependencies required by WebSocketClient
 */
export interface IWebSocketClientDependencies {
    /** Device identity for client registration */
    deviceIdentity: IDeviceIdentity;
    
    /** Storage adapter for session persistence */
    storage: IStorageAdapter;
    
    /** List of client capabilities */
    capabilities: string[];
}
