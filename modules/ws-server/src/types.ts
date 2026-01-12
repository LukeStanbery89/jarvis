/**
 * Type definitions for @jarvis/ws-server
 * Platform-agnostic WebSocket server types
 */

import { WebSocket } from 'ws';
import { BaseMessage } from '@jarvis/protocol';

/**
 * Client types that can connect to the WebSocket server
 */
export enum ClientType {
    BROWSER_EXTENSION = 'browser_extension',
    RASPBERRY_PI = 'raspberry_pi',
    HARDWARE = 'hardware',
    CLI = 'cli',
    UNKNOWN = 'unknown'
}

/**
 * Logger interface for platform-agnostic logging
 * Allows injection of Winston, console, or custom loggers
 */
export interface ILogger {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}

/**
 * Socket wrapper interface - abstracts raw WebSocket to Socket.io-like API
 */
export interface ISocketWrapper {
    readonly id: string;
    emit(event: string, data: unknown): void;
    disconnect(): void;
}

/**
 * User authentication information for WebSocket clients
 * Can be extended for custom authentication implementations
 */
export interface IUserInfo {
    userId?: string;
    sessionToken?: string;
    isAuthenticated: boolean;
    permissions: string[];
}

/**
 * Client connection information stored for each active WebSocket connection
 */
export interface IClientConnection {
    id: string;
    type: ClientType;
    userAgent?: string;
    capabilities: string[];
    metadata: Record<string, any>;
    socket: ISocketWrapper;
    connectedAt: number;
    user: IUserInfo;
}

/**
 * Client registration message sent when a new client connects
 */
export interface IClientRegistration extends BaseMessage {
    type: 'client_registration';
    clientType: ClientType;
    capabilities: string[];
    userAgent?: string;
    metadata?: Record<string, any>;
    sessionToken?: string;
    userId?: string;
}

/**
 * Handler context passed to event handlers
 */
export interface IHandlerContext {
    clientId: string;
    client?: IClientConnection;
    timestamp: number;
}

/**
 * Base interface for all WebSocket event handlers
 * Generic type parameter allows type-safe message handling
 */
export interface IEventHandler<TData = unknown> {
    readonly eventName: string;
    handle(
        socket: ISocketWrapper,
        data: TData,
        context: IHandlerContext
    ): Promise<void>;
}

/**
 * Client manager configuration options
 */
export interface IClientManagerConfig {
    defaultPermissions?: string[];    // Default permissions for unauthenticated clients
    maxMetadataSize?: number;         // Maximum metadata size in bytes, default: 10000
    maxCapabilities?: number;         // Maximum number of capabilities, default: 50
    maxUserAgentLength?: number;      // Maximum user agent length, default: 500
}

/**
 * Message format for socket communication
 * - 'envelope': MessageEnvelope structure with id, type, timestamp, payload (recommended)
 * - 'legacy': Flat structure with data spread at root level (backward compatible)
 */
export type MessageFormat = 'envelope' | 'legacy';

/**
 * WebSocket server configuration options
 */
export interface IWebSocketServerConfig {
    path?: string;                    // WebSocket endpoint path, default: /
    maxConnections?: number;          // Maximum concurrent connections, default: unlimited
    pingInterval?: number;            // Ping interval in ms, default: 30000
    clientTimeout?: number;           // Client timeout in ms, default: 60000
    messageFormat?: MessageFormat;    // Message format, default: 'envelope'
    cors?: {
        origin: string | string[];    // CORS origins
        credentials?: boolean;         // Allow credentials
    };
    clientManager?: IClientManagerConfig;  // Client manager configuration
}

/**
 * WebSocket server public API interface
 */
export interface IWebSocketServer {
    // Handler management
    registerHandler(handler: IEventHandler): void;
    getHandler(eventName: string): IEventHandler | undefined;

    // Client queries
    getClient(clientId: string): IClientConnection | undefined;
    getAllClients(): IClientConnection[];
    getClientsByType(clientType: ClientType): IClientConnection[];
    getClientsByCapability(capability: string): IClientConnection[];

    // Broadcasting
    broadcastToClientType(clientType: ClientType, event: string, data: unknown): void;
    broadcastToCapability(capability: string, event: string, data: unknown): void;

    // Statistics
    getConnectionStats(): {
        total: number;
        byType: Record<ClientType, number>;
        authenticated: number;
    };

    // Lifecycle
    shutdown(): Promise<void>;
}
