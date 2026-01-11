import { ClientType, IClientConnection, IUserInfo, ISocketWrapper, ILogger, IClientManagerConfig } from './types';
import { validateRegistrationData, sanitizeMetadata } from './utils/validation';

/**
 * Manages WebSocket client connections and their lifecycle
 * Handles client registration, storage, retrieval, and cleanup
 */
export class ClientManager {
    private activeClients = new Map<string, IClientConnection>();
    private logger: ILogger;
    private config: Required<IClientManagerConfig>;

    constructor(logger?: ILogger, config?: IClientManagerConfig) {
        // Default to console logger if none provided
        this.logger = logger || {
            info: (message: string, meta?: any) => console.log(message, meta),
            warn: (message: string, meta?: any) => console.warn(message, meta),
            error: (message: string, meta?: any) => console.error(message, meta),
            debug: (message: string, meta?: any) => console.debug(message, meta)
        };

        // Setup default configuration
        this.config = {
            defaultPermissions: config?.defaultPermissions || [],
            maxMetadataSize: config?.maxMetadataSize || 10000,
            maxCapabilities: config?.maxCapabilities || 50,
            maxUserAgentLength: config?.maxUserAgentLength || 500
        };
    }

    /**
     * Register a new client connection
     * Validates input data and sanitizes metadata
     */
    registerClient(
        socket: ISocketWrapper,
        clientType: ClientType,
        capabilities: string[],
        userAgent?: string,
        metadata?: Record<string, any>,
        user?: IUserInfo
    ): IClientConnection {
        // Validate registration data
        try {
            validateRegistrationData(capabilities, userAgent, metadata, this.config);
        } catch (error) {
            this.logger.error('Client registration validation failed', {
                service: 'ClientManager',
                error: error instanceof Error ? error.message : 'Unknown error',
                socketId: socket.id
            });
            throw error;
        }

        // Sanitize metadata to prevent injection attacks
        const sanitizedMetadata = metadata ? sanitizeMetadata(metadata) : {};

        const clientConnection: IClientConnection = {
            id: socket.id,
            type: clientType,
            userAgent,
            capabilities,
            metadata: sanitizedMetadata,
            socket,
            connectedAt: Date.now(),
            user: user || {
                userId: 'anonymous',
                isAuthenticated: false,
                permissions: this.config.defaultPermissions,
            }
        };

        this.activeClients.set(socket.id, clientConnection);

        this.logger.info('Client registered', {
            service: 'ClientManager',
            clientType,
            clientId: socket.id,
            capabilities,
            metadata,
            authenticated: clientConnection.user.isAuthenticated,
            userId: clientConnection.user.userId
        });

        return clientConnection;
    }

    /**
     * Get a client connection by socket ID
     */
    getClient(socketId: string): IClientConnection | undefined {
        return this.activeClients.get(socketId);
    }

    /**
     * Get all active client connections
     */
    getAllClients(): IClientConnection[] {
        return Array.from(this.activeClients.values());
    }

    /**
     * Get clients by type
     */
    getClientsByType(clientType: ClientType): IClientConnection[] {
        return Array.from(this.activeClients.values()).filter(
            client => client.type === clientType
        );
    }

    /**
     * Get clients by capability
     */
    getClientsByCapability(capability: string): IClientConnection[] {
        return Array.from(this.activeClients.values()).filter(client =>
            client.capabilities.includes(capability) ||
            client.capabilities.includes('all_tools')
        );
    }

    /**
     * Remove a client connection
     */
    removeClient(socketId: string): boolean {
        const client = this.activeClients.get(socketId);
        if (client) {
            this.logger.info('Client disconnected', {
                service: 'ClientManager',
                clientType: client.type || 'Unknown',
                socketId
            });
            this.activeClients.delete(socketId);
            return true;
        }
        return false;
    }

    /**
     * Check if a client supports a specific tool
     */
    clientSupportsTools(socketId: string, toolName: string): boolean {
        const client = this.getClient(socketId);
        if (!client) return false;

        return client.capabilities.includes(toolName) ||
            client.capabilities.includes('all_tools');
    }

    /**
     * Broadcast message to all clients of a specific type
     */
    broadcastToClientType(clientType: ClientType, eventName: string, data: unknown): void {
        const clients = this.getClientsByType(clientType);
        clients.forEach(client => {
            client.socket.emit(eventName, data);
        });
    }

    /**
     * Broadcast message to all clients with a specific capability
     */
    broadcastToCapability(capability: string, eventName: string, data: unknown): void {
        const clients = this.getClientsByCapability(capability);
        clients.forEach(client => {
            client.socket.emit(eventName, data);
        });
    }

    /**
     * Get total number of active connections
     */
    getConnectionCount(): number {
        return this.activeClients.size;
    }

    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        total: number;
        byType: Record<string, number>;
        authenticated: number;
    } {
        const clients = this.getAllClients();
        const stats = {
            total: clients.length,
            byType: {} as Record<string, number>,
            authenticated: 0
        };

        clients.forEach(client => {
            // Count by type
            const typeKey = client.type.toString();
            stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;

            // Count authenticated
            if (client.user.isAuthenticated) {
                stats.authenticated++;
            }
        });

        return stats;
    }
}
