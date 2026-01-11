/**
 * Tests for ClientManager
 */

import { ClientManager } from '../src/ClientManager';
import { ClientType, ISocketWrapper, ILogger } from '../src/types';

describe('ClientManager', () => {
    let clientManager: ClientManager;
    let mockLogger: ILogger;
    let mockSocket: ISocketWrapper;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        mockSocket = {
            id: 'socket-123',
            emit: jest.fn(),
            disconnect: jest.fn()
        };

        clientManager = new ClientManager(mockLogger);
    });

    describe('constructor', () => {
        it('should create instance with default config', () => {
            expect(clientManager).toBeDefined();
        });

        it('should accept custom config', () => {
            const manager = new ClientManager(mockLogger, {
                defaultPermissions: ['custom'],
                maxMetadataSize: 5000,
                maxCapabilities: 25,
                maxUserAgentLength: 250
            });
            expect(manager).toBeDefined();
        });

        it('should use console logger if none provided', () => {
            const manager = new ClientManager();
            expect(manager).toBeDefined();
        });
    });

    describe('registerClient', () => {
        it('should register a valid client', () => {
            const client = clientManager.registerClient(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['chat', 'tools'],
                'Mozilla/5.0',
                { version: '1.0.0' }
            );

            expect(client.id).toBe('socket-123');
            expect(client.type).toBe(ClientType.BROWSER_EXTENSION);
            expect(client.capabilities).toEqual(['chat', 'tools']);
            expect(client.userAgent).toBe('Mozilla/5.0');
            expect(client.metadata).toEqual({ version: '1.0.0' });
            expect(client.socket).toBe(mockSocket);
            expect(client.connectedAt).toBeLessThanOrEqual(Date.now());
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Client registered',
                expect.objectContaining({
                    clientType: ClientType.BROWSER_EXTENSION,
                    clientId: 'socket-123'
                })
            );
        });

        it('should use default permissions when no user provided', () => {
            const manager = new ClientManager(mockLogger, {
                defaultPermissions: ['read', 'write']
            });

            const client = manager.registerClient(
                mockSocket,
                ClientType.CLI,
                ['chat']
            );

            expect(client.user.permissions).toEqual(['read', 'write']);
            expect(client.user.userId).toBe('anonymous');
            expect(client.user.isAuthenticated).toBe(false);
        });

        it('should use provided user info', () => {
            const userInfo = {
                userId: 'user-456',
                isAuthenticated: true,
                permissions: ['admin']
            };

            const client = clientManager.registerClient(
                mockSocket,
                ClientType.RASPBERRY_PI,
                ['sensors'],
                undefined,
                undefined,
                userInfo
            );

            expect(client.user).toEqual(userInfo);
        });

        it('should sanitize metadata', () => {
            const client = clientManager.registerClient(
                mockSocket,
                ClientType.HARDWARE,
                ['gpio'],
                undefined,
                {
                    safe: 'value',
                    unsafeFunction: () => {}
                }
            );

            // Functions should be removed
            expect(client.metadata).toEqual({ safe: 'value' });
            expect(client.metadata).not.toHaveProperty('unsafeFunction');
        });

        it('should throw on invalid capabilities', () => {
            expect(() => {
                clientManager.registerClient(
                    mockSocket,
                    ClientType.BROWSER_EXTENSION,
                    Array(51).fill('cap'), // Too many
                    undefined,
                    undefined
                );
            }).toThrow('Too many capabilities');

            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should throw on invalid user agent', () => {
            const longUserAgent = 'a'.repeat(501);
            expect(() => {
                clientManager.registerClient(
                    mockSocket,
                    ClientType.BROWSER_EXTENSION,
                    ['chat'],
                    longUserAgent,
                    undefined
                );
            }).toThrow('User agent too long');
        });

        it('should throw on invalid metadata', () => {
            const largeMetadata = { data: 'a'.repeat(10000) };
            expect(() => {
                clientManager.registerClient(
                    mockSocket,
                    ClientType.BROWSER_EXTENSION,
                    ['chat'],
                    undefined,
                    largeMetadata
                );
            }).toThrow('Metadata too large');
        });
    });

    describe('getClient', () => {
        it('should return registered client', () => {
            clientManager.registerClient(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['chat']
            );

            const client = clientManager.getClient('socket-123');
            expect(client).toBeDefined();
            expect(client?.id).toBe('socket-123');
        });

        it('should return undefined for non-existent client', () => {
            const client = clientManager.getClient('non-existent');
            expect(client).toBeUndefined();
        });
    });

    describe('getAllClients', () => {
        it('should return empty array when no clients', () => {
            const clients = clientManager.getAllClients();
            expect(clients).toEqual([]);
        });

        it('should return all registered clients', () => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            const socket3 = { ...mockSocket, id: 'socket-789' };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat']);
            clientManager.registerClient(socket2, ClientType.CLI, ['tools']);
            clientManager.registerClient(socket3, ClientType.RASPBERRY_PI, ['sensors']);

            const clients = clientManager.getAllClients();
            expect(clients).toHaveLength(3);
            expect(clients.map(c => c.id)).toContain('socket-123');
            expect(clients.map(c => c.id)).toContain('socket-456');
            expect(clients.map(c => c.id)).toContain('socket-789');
        });
    });

    describe('getClientsByType', () => {
        beforeEach(() => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            const socket3 = { ...mockSocket, id: 'socket-789' };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat']);
            clientManager.registerClient(socket2, ClientType.BROWSER_EXTENSION, ['tools']);
            clientManager.registerClient(socket3, ClientType.CLI, ['admin']);
        });

        it('should return clients of specific type', () => {
            const browserClients = clientManager.getClientsByType(ClientType.BROWSER_EXTENSION);
            expect(browserClients).toHaveLength(2);
            expect(browserClients.every(c => c.type === ClientType.BROWSER_EXTENSION)).toBe(true);

            const cliClients = clientManager.getClientsByType(ClientType.CLI);
            expect(cliClients).toHaveLength(1);
            expect(cliClients[0].type).toBe(ClientType.CLI);
        });

        it('should return empty array for type with no clients', () => {
            const hardwareClients = clientManager.getClientsByType(ClientType.HARDWARE);
            expect(hardwareClients).toEqual([]);
        });
    });

    describe('getClientsByCapability', () => {
        beforeEach(() => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            const socket3 = { ...mockSocket, id: 'socket-789' };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat', 'tools']);
            clientManager.registerClient(socket2, ClientType.CLI, ['tools', 'admin']);
            clientManager.registerClient(socket3, ClientType.RASPBERRY_PI, ['sensors']);
        });

        it('should return clients with specific capability', () => {
            const chatClients = clientManager.getClientsByCapability('chat');
            expect(chatClients).toHaveLength(1);
            expect(chatClients[0].id).toBe('socket-123');

            const toolsClients = clientManager.getClientsByCapability('tools');
            expect(toolsClients).toHaveLength(2);
        });

        it('should return clients with all_tools capability', () => {
            const socket4 = { ...mockSocket, id: 'socket-999' };
            clientManager.registerClient(socket4, ClientType.CLI, ['all_tools']);

            const specificClients = clientManager.getClientsByCapability('anything');
            expect(specificClients).toHaveLength(1);
            expect(specificClients[0].id).toBe('socket-999');
        });

        it('should return empty array for capability with no clients', () => {
            const clients = clientManager.getClientsByCapability('non-existent');
            expect(clients).toEqual([]);
        });
    });

    describe('removeClient', () => {
        it('should remove existing client', () => {
            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat']);

            const removed = clientManager.removeClient('socket-123');
            expect(removed).toBe(true);
            expect(clientManager.getClient('socket-123')).toBeUndefined();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Client disconnected',
                expect.objectContaining({ socketId: 'socket-123' })
            );
        });

        it('should return false for non-existent client', () => {
            const removed = clientManager.removeClient('non-existent');
            expect(removed).toBe(false);
        });
    });

    describe('clientSupportsTools', () => {
        beforeEach(() => {
            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat', 'tools']);
        });

        it('should return true for supported tool', () => {
            expect(clientManager.clientSupportsTools('socket-123', 'chat')).toBe(true);
            expect(clientManager.clientSupportsTools('socket-123', 'tools')).toBe(true);
        });

        it('should return false for unsupported tool', () => {
            expect(clientManager.clientSupportsTools('socket-123', 'admin')).toBe(false);
        });

        it('should return true for clients with all_tools', () => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            clientManager.registerClient(socket2, ClientType.CLI, ['all_tools']);

            expect(clientManager.clientSupportsTools('socket-456', 'anything')).toBe(true);
        });

        it('should return false for non-existent client', () => {
            expect(clientManager.clientSupportsTools('non-existent', 'chat')).toBe(false);
        });
    });

    describe('broadcastToClientType', () => {
        beforeEach(() => {
            const socket2 = { ...mockSocket, id: 'socket-456', emit: jest.fn(), disconnect: jest.fn() };
            const socket3 = { ...mockSocket, id: 'socket-789', emit: jest.fn(), disconnect: jest.fn() };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat']);
            clientManager.registerClient(socket2, ClientType.BROWSER_EXTENSION, ['tools']);
            clientManager.registerClient(socket3, ClientType.CLI, ['admin']);
        });

        it('should broadcast to all clients of specific type', () => {
            clientManager.broadcastToClientType(ClientType.BROWSER_EXTENSION, 'test_event', { data: 'value' });

            const browserClients = clientManager.getClientsByType(ClientType.BROWSER_EXTENSION);
            expect(browserClients[0].socket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });
            expect(browserClients[1].socket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });

            const cliClients = clientManager.getClientsByType(ClientType.CLI);
            expect(cliClients[0].socket.emit).not.toHaveBeenCalled();
        });

        it('should not error when no clients of type', () => {
            expect(() => {
                clientManager.broadcastToClientType(ClientType.HARDWARE, 'test_event', {});
            }).not.toThrow();
        });
    });

    describe('broadcastToCapability', () => {
        beforeEach(() => {
            const socket2 = { ...mockSocket, id: 'socket-456', emit: jest.fn(), disconnect: jest.fn() };
            const socket3 = { ...mockSocket, id: 'socket-789', emit: jest.fn(), disconnect: jest.fn() };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat', 'tools']);
            clientManager.registerClient(socket2, ClientType.CLI, ['tools']);
            clientManager.registerClient(socket3, ClientType.RASPBERRY_PI, ['sensors']);
        });

        it('should broadcast to all clients with capability', () => {
            clientManager.broadcastToCapability('tools', 'test_event', { data: 'value' });

            const allClients = clientManager.getAllClients();
            expect(allClients[0].socket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });
            expect(allClients[1].socket.emit).toHaveBeenCalledWith('test_event', { data: 'value' });
            expect(allClients[2].socket.emit).not.toHaveBeenCalled();
        });

        it('should not error when no clients have capability', () => {
            expect(() => {
                clientManager.broadcastToCapability('non-existent', 'test_event', {});
            }).not.toThrow();
        });
    });

    describe('getConnectionCount', () => {
        it('should return 0 when no clients', () => {
            expect(clientManager.getConnectionCount()).toBe(0);
        });

        it('should return correct count', () => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            const socket3 = { ...mockSocket, id: 'socket-789' };

            clientManager.registerClient(mockSocket, ClientType.BROWSER_EXTENSION, ['chat']);
            expect(clientManager.getConnectionCount()).toBe(1);

            clientManager.registerClient(socket2, ClientType.CLI, ['tools']);
            expect(clientManager.getConnectionCount()).toBe(2);

            clientManager.registerClient(socket3, ClientType.RASPBERRY_PI, ['sensors']);
            expect(clientManager.getConnectionCount()).toBe(3);

            clientManager.removeClient('socket-456');
            expect(clientManager.getConnectionCount()).toBe(2);
        });
    });

    describe('getConnectionStats', () => {
        it('should return correct stats', () => {
            const socket2 = { ...mockSocket, id: 'socket-456' };
            const socket3 = { ...mockSocket, id: 'socket-789' };

            clientManager.registerClient(
                mockSocket,
                ClientType.BROWSER_EXTENSION,
                ['chat'],
                undefined,
                undefined,
                { userId: 'user-1', isAuthenticated: true, permissions: [] }
            );
            clientManager.registerClient(socket2, ClientType.BROWSER_EXTENSION, ['tools']);
            clientManager.registerClient(socket3, ClientType.CLI, ['admin']);

            const stats = clientManager.getConnectionStats();
            expect(stats.total).toBe(3);
            expect(stats.byType[ClientType.BROWSER_EXTENSION]).toBe(2);
            expect(stats.byType[ClientType.CLI]).toBe(1);
            expect(stats.authenticated).toBe(1);
        });

        it('should return empty stats when no clients', () => {
            const stats = clientManager.getConnectionStats();
            expect(stats.total).toBe(0);
            expect(stats.byType).toEqual({});
            expect(stats.authenticated).toBe(0);
        });
    });
});
