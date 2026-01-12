import { Server as HttpServer } from 'http';
import { container } from '../container';
import { WebSocketServer } from '@jarvis/ws-server';
import { ClientManager } from '@jarvis/ws-server';

// Import services and managers
import { AuthenticationService } from '../services/AuthenticationService';
import { ToolExecutionManager } from '@jarvis/rag-tools-server';

// Import handlers
import { RegistrationHandler } from './handlers/RegistrationHandler';
import { ChatHandler } from './handlers/ChatHandler';
import { PingHandler } from './handlers/PingHandler';
import { ClearConversationHandler } from './handlers/ClearConversationHandler';
import { ToolExecutionResponseHandler } from './handlers/ToolExecutionHandler';
import { ToolExecutionStatusHandler } from './handlers/ToolExecutionStatusHandler';

// Import types
import type { IWebSocketServerConfig, IEventHandler } from '@jarvis/ws-server';

// Import utilities
import { logger } from '@jarvis/server-utils';

/**
 * Initialize WebSocket server using @jarvis/ws-server module
 * Configured with legacy message format for backward compatibility with existing handlers
 */
export function initWebSocketServer(
    server: HttpServer,
    config: Partial<IWebSocketServerConfig> = {}
): IWebSocketServer {

    // Setup default configuration
    const defaultConfig: IWebSocketServerConfig = {
        path: '/',
        maxConnections: 0,
        pingInterval: 30000,
        clientTimeout: 60000,
        messageFormat: 'legacy',
        clientManager: {
            defaultPermissions: ['chat', 'tools', 'navigation', 'tab_management']
        }
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Resolve services from container
    const authService = container.resolve(AuthenticationService);
    const toolExecutionManager = container.resolve(ToolExecutionManager);

    // Create WebSocketServer with legacy message format for backward compatibility
    const wss = new WebSocketServer(
        server,
        {
            path: '/',
            messageFormat: 'legacy',  // Use legacy format for existing handlers
            maxConnections: 0,  // Unlimited
            pingInterval: 30000,
            clientTimeout: 60000,
            clientManager: {
                defaultPermissions: ['chat', 'tools', 'navigation', 'tab_management']
            }
        },
        logger
    );

    // Use the ClientManager from WebSocketServer (single source of truth)
    const clientManager = wss.clientManager;

    // Register the ClientManager instance with TSyringe container
    // This ensures handlers receive the correct ClientManager instance
    container.registerInstance(ClientManager, clientManager);

    // Register all handlers from TSyringe container
    const handlers: IEventHandler[] = [
        container.resolve(RegistrationHandler),
        container.resolve(ChatHandler),
        container.resolve(PingHandler),
        container.resolve(ClearConversationHandler),
        container.resolve(ToolExecutionResponseHandler),
        container.resolve(ToolExecutionStatusHandler)
    ];

    // Register each handler with the WebSocketServer
    handlers.forEach(handler => {
        wss.registerHandler(handler);
    });

    // Setup tool execution manager disconnect handling
    // Listen for client disconnections to clean up tool execution state
    const originalGetClient = wss.getClient.bind(wss);
    wss.getClient = (socketId: string) => {
        const client = originalGetClient(socketId);
        if (!client) {
            // Client was removed, notify tool execution manager
            toolExecutionManager.handleClientDisconnection(socketId);
        }
        return client;
    };

    // Create server instance with backward-compatible API
    const serverInstance: IWebSocketServer = {
        wss: wss as any,  // The underlying WebSocket server
        clientManager: clientManager as any,
        authService,

        // Handler access
        getHandler: (eventName: string) => wss.getHandler(eventName) as any,

        // Client management methods
        getClient: (socketId: string) => wss.getClient(socketId) as any,
        getAllClients: () => wss.getAllClients() as any[],
        getClientsByType: (type) => wss.getClientsByType(type) as any[],
        getClientsByCapability: (capability) => wss.getClientsByCapability(capability) as any[],

        // Broadcasting methods
        broadcastToClientType: (clientType, eventName, data) =>
            wss.broadcastToClientType(clientType, eventName, data),
        broadcastToCapability: (capability, eventName, data) =>
            wss.broadcastToCapability(capability, eventName, data),

        // Statistics
        getConnectionStats: () => wss.getConnectionStats() as any,

        // Shutdown
        shutdown: () => {
            logger.info('Shutting down WebSocket server', { service: 'WebSocketServer' });
            return wss.shutdown();
        }
    };

    logger.info('WebSocket server initialized with @jarvis/ws-server', {
        service: 'WebSocketServer',
        messageFormat: 'legacy',
        handlers: handlers.map(h => h.eventName)
    });

    return serverInstance;
}


/**
 * WebSocket Server Interface
 * Defines the public API returned by initWebSocketServer
 * Maintains backward compatibility with existing code
 */
export interface IWebSocketServer {
    wss: any;
    clientManager: any;
    authService: AuthenticationService;

    // Handler access
    getHandler(eventName: string): IEventHandler | undefined;

    // Client management
    getClient(socketId: string): any;
    getAllClients(): any[];
    getClientsByType(type: any): any[];
    getClientsByCapability(capability: string): any[];

    // Broadcasting
    broadcastToClientType(clientType: any, eventName: string, data: any): void;
    broadcastToCapability(capability: string, eventName: string, data: any): void;

    // Statistics
    getConnectionStats(): any;

    // Lifecycle
    shutdown(): void | Promise<void>;
}

// Export types for external use
export type { IWebSocketServerConfig, IEventHandler } from '@jarvis/ws-server';
export { ClientManager } from '@jarvis/ws-server';
export { AuthenticationService } from '../services/AuthenticationService';
export * from './handlers';
export {
    generateMessageId,
    generateSessionId,
    isValidMessageId,
    isValidSessionId,
    createTimestamp,
    formatTimestampForLog,
    sanitizeForLogging,
    deepClone,
    hasRequiredProperties,
    SimpleRateLimiter
} from '@jarvis/ws-server';
