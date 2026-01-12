import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { IncomingMessage } from 'http';
import {
    IWebSocketServerConfig,
    IWebSocketServer,
    IEventHandler,
    IHandlerContext,
    IClientConnection,
    ILogger,
    ClientType
} from './types';
import { ClientManager } from './ClientManager';
import { createSocketWrapper } from './utils/socket-wrapper';
import { generateMessageId } from './utils/helpers';
import { isValidMessage, validateServerConfig } from './utils/validation';

/**
 * Platform-agnostic WebSocket server with client management and message routing
 * Provides a clean interface for handling WebSocket connections and events
 */
export class WebSocketServer implements IWebSocketServer {
    private wss: WSServer;
    private handlers = new Map<string, IEventHandler<any>>();
    public readonly clientManager: ClientManager;  // Expose for integration with DI containers
    private logger: ILogger;
    private config: Required<IWebSocketServerConfig>;

    constructor(
        httpServer: HttpServer,
        config?: Partial<IWebSocketServerConfig>,
        logger?: ILogger
    ) {
        // Setup default configuration
        const defaultConfig: Required<IWebSocketServerConfig> = {
            path: '/',
            maxConnections: 0, // 0 = unlimited
            pingInterval: 30000,
            clientTimeout: 60000,
            messageFormat: 'envelope',
            cors: {
                origin: '*',
                credentials: false
            },
            clientManager: {
                defaultPermissions: [],
                maxMetadataSize: 10000,
                maxCapabilities: 50,
                maxUserAgentLength: 500
            }
        };

        this.config = { ...defaultConfig, ...config };

        // Validate configuration
        validateServerConfig(this.config);

        // Default to console logger if none provided
        this.logger = logger || {
            info: (message: string, meta?: any) => console.log(message, meta),
            warn: (message: string, meta?: any) => console.warn(message, meta),
            error: (message: string, meta?: any) => console.error(message, meta),
            debug: (message: string, meta?: any) => console.debug(message, meta)
        };

        // Initialize ClientManager with logger and config
        this.clientManager = new ClientManager(this.logger, this.config.clientManager);

        // Initialize WebSocket server
        this.wss = new WSServer({
            server: httpServer,
            path: this.config.path,
            perMessageDeflate: false // Disable compression for simplicity
        });

        // Setup connection handling
        this.setupConnectionHandling();

        this.logger.info('WebSocket server initialized', {
            service: 'WebSocketServer',
            path: this.config.path,
            maxConnections: this.config.maxConnections
        });
    }

    /**
     * Register an event handler
     */
    registerHandler(handler: IEventHandler<any>): void {
        this.handlers.set(handler.eventName, handler);
        this.logger.info('Handler registered', {
            service: 'WebSocketServer',
            eventName: handler.eventName
        });
    }

    /**
     * Get a registered event handler by name
     */
    getHandler(eventName: string): IEventHandler<any> | undefined {
        return this.handlers.get(eventName);
    }

    /**
     * Get a client by socket ID
     */
    getClient(clientId: string): IClientConnection | undefined {
        return this.clientManager.getClient(clientId);
    }

    /**
     * Get all active clients
     */
    getAllClients(): IClientConnection[] {
        return this.clientManager.getAllClients();
    }

    /**
     * Get clients by type
     */
    getClientsByType(clientType: ClientType): IClientConnection[] {
        return this.clientManager.getClientsByType(clientType);
    }

    /**
     * Get clients by capability
     */
    getClientsByCapability(capability: string): IClientConnection[] {
        return this.clientManager.getClientsByCapability(capability);
    }

    /**
     * Broadcast message to all clients of a specific type
     */
    broadcastToClientType(clientType: ClientType, event: string, data: unknown): void {
        this.clientManager.broadcastToClientType(clientType, event, data);
    }

    /**
     * Broadcast message to all clients with a specific capability
     */
    broadcastToCapability(capability: string, event: string, data: unknown): void {
        this.clientManager.broadcastToCapability(capability, event, data);
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        total: number;
        byType: Record<ClientType, number>;
        authenticated: number;
    } {
        return this.clientManager.getConnectionStats();
    }

    /**
     * Shutdown the WebSocket server
     */
    async shutdown(): Promise<void> {
        this.logger.info('Shutting down WebSocket server', { service: 'WebSocketServer' });

        // Notify all clients about shutdown
        const clients = this.clientManager.getAllClients();
        for (const client of clients) {
            try {
                client.socket.emit('server_shutdown', {
                    message: 'Server is shutting down',
                    timestamp: Date.now()
                });
            } catch (error) {
                // Ignore errors during shutdown notification
            }
        }

        // Give clients a moment to receive the shutdown message
        await new Promise(resolve => setTimeout(resolve, 100));

        // Close all client connections
        for (const client of clients) {
            try {
                client.socket.disconnect();
                this.clientManager.removeClient(client.id);
            } catch (error) {
                // Ignore errors during shutdown
            }
        }

        // Close the WebSocket server
        return new Promise<void>((resolve, reject) => {
            this.wss.close((error?: Error) => {
                if (error) {
                    this.logger.error('Error shutting down WebSocket server', {
                        service: 'WebSocketServer',
                        error: error.message
                    });
                    reject(error);
                } else {
                    this.logger.info('WebSocket server shut down successfully', {
                        service: 'WebSocketServer'
                    });
                    resolve();
                }
            });
        });
    }

    /**
     * Setup connection handling logic
     */
    private setupConnectionHandling(): void {
        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            // Check max connections limit
            if (this.config.maxConnections > 0 && this.clientManager.getConnectionCount() >= this.config.maxConnections) {
                this.logger.warn('Maximum connections reached, rejecting new connection', {
                    service: 'WebSocketServer',
                    maxConnections: this.config.maxConnections
                });
                ws.close(1008, 'Maximum connections reached');
                return;
            }

            const socketId = this.generateSocketId();

            this.logger.info('Client connected', {
                service: 'WebSocketServer',
                socketId
            });

            // Create socket wrapper with logger and message format
            const socketWrapper = createSocketWrapper(ws, socketId, this.config.messageFormat, this.logger);

            // Handle incoming messages
            ws.on('message', async (data: Buffer) => {
                let parsedMessage: any;

                // Parse JSON with specific error handling
                try {
                    parsedMessage = JSON.parse(data.toString());
                } catch (parseError) {
                    this.logger.error('Invalid JSON received', {
                        service: 'WebSocketServer',
                        socketId,
                        error: parseError instanceof Error ? parseError.message : 'Unknown'
                    });

                    socketWrapper.emit('error', {
                        message: 'Invalid JSON format',
                        code: 'INVALID_JSON'
                    });
                    return;
                }

                // Validate message structure
                if (!isValidMessage(parsedMessage)) {
                    this.logger.warn('Invalid message structure', {
                        service: 'WebSocketServer',
                        socketId,
                        message: parsedMessage
                    });

                    socketWrapper.emit('error', {
                        message: 'Invalid message structure',
                        code: 'INVALID_MESSAGE'
                    });
                    return;
                }

                // Route to handler
                try {
                    const handler = this.handlers.get(parsedMessage.type);

                    if (handler) {
                        const context: IHandlerContext = {
                            clientId: socketId,
                            client: this.clientManager.getClient(socketId),
                            timestamp: Date.now()
                        };

                        await handler.handle(socketWrapper, parsedMessage, context);
                    } else {
                        this.logger.warn('Unknown message type', {
                            service: 'WebSocketServer',
                            messageType: parsedMessage.type,
                            socketId
                        });

                        socketWrapper.emit('error', {
                            message: `Unknown message type: ${parsedMessage.type}`,
                            code: 'UNKNOWN_MESSAGE_TYPE'
                        });
                    }
                } catch (handlerError) {
                    this.logger.error('Handler execution failed', {
                        service: 'WebSocketServer',
                        error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
                        socketId,
                        messageType: parsedMessage.type
                    });

                    socketWrapper.emit('error', {
                        message: 'Internal server error',
                        code: 'HANDLER_ERROR'
                    });
                }
            });

            // Handle disconnection
            ws.on('close', (code: number, reason: Buffer) => {
                this.logger.info('Client disconnected', {
                    service: 'WebSocketServer',
                    socketId,
                    code,
                    reason: reason.toString()
                });

                // Remove from client manager (single source of truth)
                this.clientManager.removeClient(socketId);
            });

            // Handle connection errors
            ws.on('error', (error: Error) => {
                this.logger.error('Socket error', {
                    service: 'WebSocketServer',
                    error: error.message,
                    socketId
                });
            });
        });
    }

    /**
     * Generate unique socket ID
     */
    private generateSocketId(): string {
        return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
