import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { IncomingMessage } from 'http';
import { container } from '../container';

// Import services and managers
import { ClientManager } from './ClientManager';
import { AuthenticationService } from '../services/AuthenticationService';
import { ToolExecutionManager } from '../tools/browser/ToolExecutionManager';

// Import handlers
import { RegistrationHandler } from './handlers/RegistrationHandler';
import { ChatHandler } from './handlers/ChatHandler';
import { PingHandler } from './handlers/PingHandler';
import { ClearConversationHandler } from './handlers/ClearConversationHandler';
import { ToolExecutionResponseHandler } from './handlers/ToolExecutionHandler';
import { ToolExecutionStatusHandler } from './handlers/ToolExecutionStatusHandler';

// Import types
import { IWebSocketConfig, IEventHandler, IClientConnection } from './types';

// Import utilities
import { logger } from '../utils/logger';

/**
 * Initialize WebSocket server with clean, modular architecture
 * Handles client connections, event routing, and service coordination
 */
export function initWebSocketServer(
    server: HttpServer,
    config: Partial<IWebSocketConfig> = {}
): IWebSocketServer {

    // Setup default configuration
    const defaultConfig: IWebSocketConfig = {
        corsOrigins: "*",
        transports: ['websocket'],
        maxConversationMessages: 20
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Initialize raw WebSocket server
    const wss = new WebSocketServer({
        server,
        perMessageDeflate: false // Disable compression for simplicity
    });

    // Store client connections
    const clients = new Map<string, { ws: WebSocket, client: IClientConnection }>();

    // Resolve services from container
    const clientManager = container.resolve(ClientManager);
    const authService = container.resolve(AuthenticationService);
    const toolExecutionManager = container.resolve(ToolExecutionManager);

    // Initialize handlers
    const handlers = new Map<string, IEventHandler>();
    registerHandler(container.resolve(RegistrationHandler));
    registerHandler(container.resolve(ChatHandler));
    registerHandler(container.resolve(PingHandler));
    registerHandler(container.resolve(ClearConversationHandler));
    registerHandler(container.resolve(ToolExecutionResponseHandler));
    registerHandler(container.resolve(ToolExecutionStatusHandler));

    function registerHandler(handler: IEventHandler): void {
        handlers.set(handler.eventName, handler);
        logger.info('Handler registered', {
            service: 'WebSocketServer',
            eventName: handler.eventName
        });
    }

    // Setup connection handling
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const socketId = generateSocketId();

        logger.info('Client connected', {
            service: 'WebSocketServer',
            socketId
        });

        // Create socket wrapper for compatibility
        const socketWrapper = createSocketWrapper(ws, socketId);
        clients.set(socketId, { ws, client: null as any });

        // Handle incoming messages
        ws.on('message', async (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                const handler = handlers.get(message.type);

                if (handler) {
                    const context = {
                        clientId: socketId,
                        client: clientManager.getClient(socketId),
                        timestamp: Date.now()
                    };

                    await handler.handle(socketWrapper, message, context);
                } else {
                    logger.warn('Unknown message type', {
                        service: 'WebSocketServer',
                        messageType: message.type,
                        socketId
                    });
                }
            } catch (error) {
                logger.error('Message handling failed', {
                    service: 'WebSocketServer',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    socketId
                });

                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        id: generateMessageId(),
                        type: 'error',
                        timestamp: Date.now(),
                        message: 'Internal server error'
                    }));
                }
            }
        });

        // Handle disconnection
        ws.on('close', (code: number, reason: Buffer) => {
            logger.info('Client disconnected', {
                service: 'WebSocketServer',
                socketId,
                code,
                reason: reason.toString()
            });

            // Notify tool execution manager about client disconnection
            toolExecutionManager.handleClientDisconnection(socketId);

            clientManager.removeClient(socketId);
            clients.delete(socketId);
        });

        // Handle connection errors
        ws.on('error', (error: Error) => {
            logger.error('Socket error', {
                service: 'WebSocketServer',
                error: error.message,
                socketId
            });
        });
    });

    // Create server instance with public API
    const serverInstance: IWebSocketServer = {
        wss,
        clientManager,
        authService,

        // Handler access
        getHandler: (eventName: string) => handlers.get(eventName),

        // Client management methods
        getClient: (socketId: string) => clientManager.getClient(socketId),
        getAllClients: () => clientManager.getAllClients(),
        getClientsByType: (type) => clientManager.getClientsByType(type),
        getClientsByCapability: (capability) => clientManager.getClientsByCapability(capability),

        // Broadcasting methods
        broadcastToClientType: (clientType, eventName, data) =>
            clientManager.broadcastToClientType(clientType, eventName, data),
        broadcastToCapability: (capability, eventName, data) =>
            clientManager.broadcastToCapability(capability, eventName, data),

        // Statistics
        getConnectionStats: () => clientManager.getConnectionStats(),

        // Shutdown
        shutdown: () => {
            logger.info('Shutting down WebSocket server', { service: 'WebSocketServer' });
            wss.close();
        }
    };

    logger.info('WebSocket server initialized', {
        service: 'WebSocketServer',
        handlers: Array.from(handlers.keys())
    });

    return serverInstance;
}


/**
 * Generate unique message ID
 */
function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique socket ID
 */
function generateSocketId(): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create Socket.io-compatible wrapper for raw WebSocket
 */
function createSocketWrapper(ws: WebSocket, id: string) {
    return {
        id,
        emit: (event: string, data: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                const message = { ...data, type: event };
                ws.send(JSON.stringify(message));
            }
        },
        disconnect: () => {
            ws.close();
        }
    };
}

/**
 * WebSocket Server Interface
 * Defines the public API returned by initWebSocketServer
 */
export interface IWebSocketServer {
    wss: WebSocketServer;
    clientManager: ClientManager;
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
    shutdown(): void;
}

// Export types for external use
export * from './types';
export { ClientManager } from './ClientManager';
export { AuthenticationService } from '../services/AuthenticationService';
export * from './handlers';
export * from './utils/helpers';