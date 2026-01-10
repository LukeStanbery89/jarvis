import { injectable } from 'tsyringe';
import { WebSocket } from 'ws';
import { ClientType, IClientConnection, IUserInfo } from './types';
import { logger } from '../utils/logger';

/**
 * Manages WebSocket client connections and their lifecycle
 * Handles client registration, storage, retrieval, and cleanup
 */
@injectable()
export class ClientManager {
    private activeClients = new Map<string, IClientConnection>();

    /**
     * Register a new client connection
     */
    registerClient(
        socket: { id: string; emit: (event: string, data: any) => void; disconnect: () => void },
        clientType: ClientType,
        capabilities: string[],
        userAgent?: string,
        metadata?: Record<string, any>,
        user?: IUserInfo
    ): IClientConnection {
        const clientConnection: IClientConnection = {
            id: socket.id,
            type: clientType,
            userAgent,
            capabilities,
            metadata: metadata || {},
            socket,
            connectedAt: Date.now(),
            user: user || {
                userId: 'anonymous',
                isAuthenticated: false,
                permissions: [
                    'chat',
                    'tools',
                    'navigation',
                    'tab_management',
                ],
            }
        };

        this.activeClients.set(socket.id, clientConnection);

        logger.info('Client registered', {
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
            logger.info('Client disconnected', {
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
    broadcastToClientType(clientType: ClientType, eventName: string, data: any): void {
        const clients = this.getClientsByType(clientType);
        clients.forEach(client => {
            client.socket.emit(eventName, data);
        });
    }

    /**
     * Broadcast message to all clients with a specific capability
     */
    broadcastToCapability(capability: string, eventName: string, data: any): void {
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