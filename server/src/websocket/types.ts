import { WebSocket } from 'ws';
import {
    BaseMessage,
    ChatMessage,
    ToolResponse,
    AgentResponse,
    ToolRequest,
    AgentStatus
} from '@jarvis/protocol';

/**
 * Client types that can connect to the WebSocket server
 */
export enum ClientType {
    BROWSER_EXTENSION = 'browser_extension',
    UNKNOWN = 'unknown'
}

/**
 * User authentication information for WebSocket clients
 * Currently a placeholder for future authentication implementation
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
    socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void };
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
 * Conversation message for chat context management
 */
export interface IConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
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
 */
export interface IEventHandler {
    readonly eventName: string;
    handle(socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void }, data: any, context: IHandlerContext): Promise<void>;
}

/**
 * WebSocket server capabilities that can be queried by clients
 */
export interface IServerCapabilities {
    chat: boolean;
    agent_processing: boolean;
    tool_orchestration: boolean;
    multi_client_support: boolean;
    real_time_status: boolean;
}

/**
 * WebSocket server configuration options
 */
export interface IWebSocketConfig {
    corsOrigins: string | string[];
    transports: ('websocket')[];
    maxConversationMessages: number;
}