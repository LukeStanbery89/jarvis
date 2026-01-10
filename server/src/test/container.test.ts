import 'reflect-metadata';
import { container as tsyringeContainer } from 'tsyringe';
import { setupContainer, container } from '../container';
import { ChatService, CHAT_SERVICE_TOKEN } from '../services/ChatService';
import { AuthenticationService } from '../services/AuthenticationService';
import { ClientManager } from '../websocket/ClientManager';

// Mock external dependencies
jest.mock('../services/ChatService');
jest.mock('../services/AuthenticationService');
jest.mock('../websocket/ClientManager');

describe('Container', () => {
    beforeEach(() => {
        // Clear the container before each test
        tsyringeContainer.clearInstances();
    });

    afterEach(() => {
        // Clean up after each test
        tsyringeContainer.clearInstances();
    });

    describe('setupContainer', () => {
        it('should register ChatService as singleton', () => {
            setupContainer();
            
            const instance1 = container.resolve<ChatService>(CHAT_SERVICE_TOKEN);
            const instance2 = container.resolve<ChatService>(CHAT_SERVICE_TOKEN);
            
            expect(instance1).toBeDefined();
            expect(instance2).toBeDefined();
            expect(instance1).toBe(instance2); // Should be same instance (singleton)
        });

        it('should register AuthenticationService', () => {
            setupContainer();
            
            const instance = container.resolve<AuthenticationService>(AuthenticationService);
            
            expect(instance).toBeDefined();
            expect(instance).toBeInstanceOf(AuthenticationService);
        });

        it('should register ClientManager', () => {
            setupContainer();
            
            const instance = container.resolve<ClientManager>(ClientManager);
            
            expect(instance).toBeDefined();
            expect(instance).toBeInstanceOf(ClientManager);
        });

        it('should register AuthenticationService as non-singleton', () => {
            setupContainer();
            
            const instance1 = container.resolve<AuthenticationService>(AuthenticationService);
            const instance2 = container.resolve<AuthenticationService>(AuthenticationService);
            
            expect(instance1).toBeDefined();
            expect(instance2).toBeDefined();
            expect(instance1).not.toBe(instance2); // Should be different instances
        });

        it('should register ClientManager as non-singleton', () => {
            setupContainer();
            
            const instance1 = container.resolve<ClientManager>(ClientManager);
            const instance2 = container.resolve<ClientManager>(ClientManager);
            
            expect(instance1).toBeDefined();
            expect(instance2).toBeDefined();
            expect(instance1).not.toBe(instance2); // Should be different instances
        });
    });

    describe('container export', () => {
        it('should export the tsyringe container', () => {
            expect(container).toBe(tsyringeContainer);
        });
    });
});