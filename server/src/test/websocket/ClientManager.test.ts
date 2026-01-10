import 'reflect-metadata';
import { ClientManager } from '../../websocket/ClientManager';
import { ClientType, IUserInfo } from '../../websocket/types';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger');

describe('ClientManager', () => {
    let clientManager: ClientManager;
    let mockSocket: { id: string; emit: jest.Mock };
    let mockUserInfo: IUserInfo;

    beforeEach(() => {
        clientManager = new ClientManager();
        mockSocket = {
            id: 'socket-123',
            emit: jest.fn()
        };
        mockUserInfo = {
            userId: 'user-123',
            isAuthenticated: true,
            permissions: ['chat', 'tools']
        };
        jest.clearAllMocks();
    });

    describe('registerClient', () => {
        it('should register a new client successfully', () => {
            const client = clientManager.registerClient(
                mockSocket as any,
                ClientType.BROWSER_EXTENSION,
                ['page_content'],
                'Mozilla/5.0',
                { version: '1.0' },
                mockUserInfo
            );

            expect(client).toEqual({
                id: 'socket-123',
                type: ClientType.BROWSER_EXTENSION,
                userAgent: 'Mozilla/5.0',
                capabilities: ['page_content'],
                metadata: { version: '1.0' },
                socket: mockSocket,
                connectedAt: expect.any(Number),
                user: mockUserInfo
            });
        });

        it('should register client with minimal parameters', () => {
            const client = clientManager.registerClient(
                mockSocket as any,
                ClientType.BROWSER_EXTENSION,
                ['basic']
            );

            expect(client.id).toBe('socket-123');
            expect(client.type).toBe(ClientType.BROWSER_EXTENSION);
            expect(client.capabilities).toEqual(['basic']);
            expect(client.user.userId).toBe('anonymous');
            expect(client.user.isAuthenticated).toBe(false);
        });
    });

    describe('getClient', () => {
        it('should return existing client', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            const client = clientManager.getClient('socket-123');
            
            expect(client).toBeDefined();
            expect(client?.id).toBe('socket-123');
        });

        it('should return undefined for non-existent client', () => {
            const client = clientManager.getClient('non-existent');
            
            expect(client).toBeUndefined();
        });
    });

    describe('removeClient', () => {
        it('should remove existing client and return true', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            const result = clientManager.removeClient('socket-123');
            
            expect(result).toBe(true);
            expect(clientManager.getClient('socket-123')).toBeUndefined();
        });

        it('should return false for non-existent client', () => {
            const result = clientManager.removeClient('non-existent');
            
            expect(result).toBe(false);
        });
    });

    describe('getClientsByType', () => {
        it('should return clients of specified type', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            const clients = clientManager.getClientsByType(ClientType.BROWSER_EXTENSION);
            
            expect(clients).toHaveLength(1);
            expect(clients[0].id).toBe('socket-123');
        });

        it('should return empty array for non-existent type', () => {
            const clients = clientManager.getClientsByType(ClientType.UNKNOWN);
            
            expect(clients).toHaveLength(0);
        });
    });

    describe('getClientsByCapability', () => {
        it('should return clients with specified capability', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content', 'dom_manipulation']);
            
            const clients = clientManager.getClientsByCapability('page_content');
            
            expect(clients).toHaveLength(1);
            expect(clients[0].capabilities).toContain('page_content');
        });

        it('should return empty array for non-existent capability', () => {
            const clients = clientManager.getClientsByCapability('non_existent');
            
            expect(clients).toHaveLength(0);
        });
    });

    describe('getAllClients', () => {
        it('should return all registered clients', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            const clients = clientManager.getAllClients();
            
            expect(clients).toHaveLength(1);
            expect(clients[0].id).toBe('socket-123');
        });

        it('should return empty array when no clients registered', () => {
            const clients = clientManager.getAllClients();
            
            expect(clients).toHaveLength(0);
        });
    });

    describe('getConnectionStats', () => {
        it('should return correct connection statistics', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            const stats = clientManager.getConnectionStats();
            
            expect(stats.total).toBe(1);
            expect(stats.byType[ClientType.BROWSER_EXTENSION]).toBe(1);
            expect(stats.authenticated).toBe(0); // No authenticated user provided
        });

        it('should count authenticated clients correctly', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test'], 'Mozilla/5.0', {}, mockUserInfo);
            
            const stats = clientManager.getConnectionStats();
            
            expect(stats.total).toBe(1);
            expect(stats.authenticated).toBe(1);
        });

        it('should group clients by type correctly', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            clientManager.registerClient(mockSocket2 as any, ClientType.UNKNOWN, ['test']);
            
            const stats = clientManager.getConnectionStats();
            
            expect(stats.total).toBe(2);
            expect(stats.byType[ClientType.BROWSER_EXTENSION]).toBe(1);
            expect(stats.byType[ClientType.UNKNOWN]).toBe(1);
        });

        it('should return empty stats when no clients', () => {
            const stats = clientManager.getConnectionStats();
            
            expect(stats.total).toBe(0);
            expect(stats.byType).toEqual({});
            expect(stats.authenticated).toBe(0);
        });
    });

    describe('clientSupportsTools', () => {
        beforeEach(() => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content', 'dom_manipulation']);
        });

        it('should return true for client with specific tool capability', () => {
            const result = clientManager.clientSupportsTools('socket-123', 'page_content');
            
            expect(result).toBe(true);
        });

        it('should return false for client without specific tool capability', () => {
            const result = clientManager.clientSupportsTools('socket-123', 'file_system');
            
            expect(result).toBe(false);
        });

        it('should return true for client with all_tools capability', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['all_tools']);
            
            const result = clientManager.clientSupportsTools('socket-456', 'any_tool');
            
            expect(result).toBe(true);
        });

        it('should return false for non-existent client', () => {
            const result = clientManager.clientSupportsTools('non-existent', 'page_content');
            
            expect(result).toBe(false);
        });
    });

    describe('broadcastToClientType', () => {
        it('should broadcast message to all clients of specified type', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['test']);
            
            clientManager.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test_event', { data: 'test' });
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
            expect(mockSocket2.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
        });

        it('should not broadcast to clients of different type', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            clientManager.registerClient(mockSocket2 as any, ClientType.UNKNOWN, ['test']);
            
            clientManager.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test_event', { data: 'test' });
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
            expect(mockSocket2.emit).not.toHaveBeenCalled();
        });

        it('should handle empty client list gracefully', () => {
            clientManager.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test_event', { data: 'test' });
            
            // Should not throw error
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('broadcastToCapability', () => {
        it('should broadcast message to all clients with specified capability', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['page_content', 'dom_manipulation']);
            
            clientManager.broadcastToCapability('page_content', 'test_event', { data: 'test' });
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
            expect(mockSocket2.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
        });

        it('should broadcast to clients with all_tools capability', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['specific_tool']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['all_tools']);
            
            clientManager.broadcastToCapability('page_content', 'test_event', { data: 'test' });
            
            expect(mockSocket.emit).not.toHaveBeenCalled();
            expect(mockSocket2.emit).toHaveBeenCalledWith('test_event', { data: 'test' });
        });

        it('should not broadcast to clients without capability', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['different_capability']);
            
            clientManager.broadcastToCapability('page_content', 'test_event', { data: 'test' });
            
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });

        it('should handle empty client list gracefully', () => {
            clientManager.broadcastToCapability('page_content', 'test_event', { data: 'test' });
            
            // Should not throw error
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('getConnectionCount', () => {
        it('should return correct connection count', () => {
            expect(clientManager.getConnectionCount()).toBe(0);
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            expect(clientManager.getConnectionCount()).toBe(1);
            
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['test']);
            expect(clientManager.getConnectionCount()).toBe(2);
            
            clientManager.removeClient('socket-123');
            expect(clientManager.getConnectionCount()).toBe(1);
        });
    });

    describe('getClientsByCapability with all_tools', () => {
        it('should include clients with all_tools in capability searches', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['all_tools']);
            
            const clients = clientManager.getClientsByCapability('any_capability');
            
            expect(clients).toHaveLength(1);
            expect(clients[0].id).toBe('socket-456');
        });

        it('should return clients with both specific and all_tools capability', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['all_tools']);
            
            const clients = clientManager.getClientsByCapability('page_content');
            
            expect(clients).toHaveLength(2);
            expect(clients.find(c => c.id === 'socket-123')).toBeDefined();
            expect(clients.find(c => c.id === 'socket-456')).toBeDefined();
        });
    });

    describe('logging', () => {
        it('should log client registration', () => {
            clientManager.registerClient(
                mockSocket as any,
                ClientType.BROWSER_EXTENSION,
                ['page_content'],
                'Mozilla/5.0',
                { version: '1.0' },
                mockUserInfo
            );

            expect(logger.info).toHaveBeenCalledWith('Client registered', {
                service: 'ClientManager',
                clientType: ClientType.BROWSER_EXTENSION,
                clientId: 'socket-123',
                capabilities: ['page_content'],
                metadata: { version: '1.0' },
                authenticated: true,
                userId: 'user-123'
            });
        });

        it('should log client disconnection', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            clientManager.removeClient('socket-123');

            expect(logger.info).toHaveBeenCalledWith('Client disconnected', {
                service: 'ClientManager',
                clientType: ClientType.BROWSER_EXTENSION,
                socketId: 'socket-123'
            });
        });

        it('should handle client type fallback in logging', () => {
            // Register a client and manually modify its type to test fallback
            const client = clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['test']);
            (client as any).type = null; // Simulate missing type
            
            clientManager.removeClient('socket-123');

            expect(logger.info).toHaveBeenCalledWith('Client disconnected', {
                service: 'ClientManager',
                clientType: 'Unknown',
                socketId: 'socket-123'
            });
        });
    });

    describe('edge cases', () => {
        it('should handle multiple clients with same capabilities', () => {
            const mockSocket2 = { id: 'socket-456', emit: jest.fn() };
            const mockSocket3 = { id: 'socket-789', emit: jest.fn() };
            
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, ['page_content']);
            clientManager.registerClient(mockSocket2 as any, ClientType.BROWSER_EXTENSION, ['page_content']);
            clientManager.registerClient(mockSocket3 as any, ClientType.UNKNOWN, ['page_content']);
            
            const byCapability = clientManager.getClientsByCapability('page_content');
            const byType = clientManager.getClientsByType(ClientType.BROWSER_EXTENSION);
            
            expect(byCapability).toHaveLength(3);
            expect(byType).toHaveLength(2);
        });

        it('should handle empty capabilities array', () => {
            clientManager.registerClient(mockSocket as any, ClientType.BROWSER_EXTENSION, []);
            
            const clients = clientManager.getClientsByCapability('any_capability');
            expect(clients).toHaveLength(0);
            
            const supportsTools = clientManager.clientSupportsTools('socket-123', 'any_tool');
            expect(supportsTools).toBe(false);
        });
    });
});