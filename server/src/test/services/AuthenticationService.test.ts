import 'reflect-metadata';
import { AuthenticationService } from '../../services/AuthenticationService';
import { IUserInfo } from '../../websocket/types';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger');

describe('AuthenticationService', () => {
    let authService: AuthenticationService;

    beforeEach(() => {
        authService = new AuthenticationService();
        jest.clearAllMocks();
    });

    describe('authenticateUser', () => {
        it('should authenticate user with valid token and userId', async () => {
            const userInfo = await authService.authenticateUser('valid-token', 'test-user');

            expect(userInfo).toEqual({
                userId: 'test-user',
                sessionToken: 'valid-token',
                isAuthenticated: true,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools', 'advanced_features', 'file_upload']
            });
        });

        it('should authenticate user with token but no userId', async () => {
            const userInfo = await authService.authenticateUser('valid-token');

            expect(userInfo).toEqual({
                userId: 'anonymous',
                sessionToken: 'valid-token',
                isAuthenticated: true,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools', 'advanced_features', 'file_upload']
            });
        });

        it('should authenticate user with no token', async () => {
            const userInfo = await authService.authenticateUser();

            expect(userInfo).toEqual({
                userId: 'anonymous',
                sessionToken: undefined,
                isAuthenticated: false,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools']
            });
        });

        it('should authenticate user with empty token', async () => {
            const userInfo = await authService.authenticateUser('', 'test-user');

            expect(userInfo).toEqual({
                userId: 'test-user',
                sessionToken: '',
                isAuthenticated: false,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools']
            });
        });
    });

    describe('hasPermission', () => {
        let testUser: IUserInfo;

        beforeEach(() => {
            testUser = {
                userId: 'test-user',
                sessionToken: 'test-token',
                isAuthenticated: true,
                permissions: ['chat', 'tools']
            };
        });

        it('should return true for user with required permission', () => {
            const hasPermission = authService.hasPermission(testUser, 'chat');

            expect(hasPermission).toBe(true);
        });

        it('should return false for user without required permission', () => {
            testUser.permissions = ['tools']; // Remove chat permission

            const hasPermission = authService.hasPermission(testUser, 'chat');

            expect(hasPermission).toBe(false);
        });

        it('should return false for user with empty permissions', () => {
            testUser.permissions = [];

            const hasPermission = authService.hasPermission(testUser, 'chat');

            expect(hasPermission).toBe(false);
        });

        it('should handle case-sensitive permissions', () => {
            const hasPermission = authService.hasPermission(testUser, 'CHAT');

            expect(hasPermission).toBe(false);
        });

        it('should return true for tools permission', () => {
            const hasPermission = authService.hasPermission(testUser, 'tools');

            expect(hasPermission).toBe(true);
        });

        it('should throw error for user with undefined permissions', () => {
            const userWithoutPermissions = {
                userId: 'test-user',
                isAuthenticated: true,
                permissions: undefined as any
            };

            expect(() => {
                authService.hasPermission(userWithoutPermissions, 'chat');
            }).toThrow();
        });
    });


    describe('edge cases', () => {
        it('should throw error for null user in hasPermission', () => {
            expect(() => {
                authService.hasPermission(null as any, 'chat');
            }).toThrow();
        });

        it('should throw error for undefined user in hasPermission', () => {
            expect(() => {
                authService.hasPermission(undefined as any, 'chat');
            }).toThrow();
        });

        it('should handle empty permission string', () => {
            const testUser: IUserInfo = {
                userId: 'test-user',
                sessionToken: 'token',
                isAuthenticated: true,
                permissions: ['chat', 'tools']
            };

            const result = authService.hasPermission(testUser, '');

            expect(result).toBe(false);
        });
    });

    describe('canUseTool', () => {
        let testUser: IUserInfo;

        beforeEach(() => {
            testUser = {
                userId: 'test-user',
                sessionToken: 'test-token',
                isAuthenticated: true,
                permissions: ['chat', 'tools']
            };
        });

        it('should return true for user with tools permission', () => {
            const result = authService.canUseTool(testUser, 'web_search');

            expect(result).toBe(true);
        });

        it('should return false for user without tools permission', () => {
            testUser.permissions = ['chat']; // Remove tools permission

            const result = authService.canUseTool(testUser, 'web_search');

            expect(result).toBe(false);
        });

        it('should return false for restricted tools when user not authenticated', () => {
            testUser.isAuthenticated = false;

            const result = authService.canUseTool(testUser, 'system_commands');

            expect(result).toBe(false);
        });

        it('should return false for file_system_access when user not authenticated', () => {
            testUser.isAuthenticated = false;

            const result = authService.canUseTool(testUser, 'file_system_access');

            expect(result).toBe(false);
        });

        it('should return true for restricted tools when user is authenticated', () => {
            const result = authService.canUseTool(testUser, 'system_commands');

            expect(result).toBe(true);
        });

        it('should return true for regular tools regardless of authentication if has tools permission', () => {
            testUser.isAuthenticated = false;

            const result = authService.canUseTool(testUser, 'web_search');

            expect(result).toBe(true);
        });
    });

    describe('refreshSession', () => {
        it('should log debug message and return null', async () => {
            const result = await authService.refreshSession('test-token');

            expect(logger.debug).toHaveBeenCalledWith('Session refresh requested', {
                service: 'AuthenticationService',
                tokenLength: 10
            });
            expect(result).toBeNull();
        });

        it('should handle empty token', async () => {
            const result = await authService.refreshSession('');

            expect(logger.debug).toHaveBeenCalledWith('Session refresh requested', {
                service: 'AuthenticationService',
                tokenLength: 0
            });
            expect(result).toBeNull();
        });
    });

    describe('revokeSession', () => {
        it('should log debug message and return true', async () => {
            const result = await authService.revokeSession('test-token');

            expect(logger.debug).toHaveBeenCalledWith('Session revocation requested', {
                service: 'AuthenticationService',
                tokenLength: 10
            });
            expect(result).toBe(true);
        });

        it('should handle long token', async () => {
            const longToken = 'a'.repeat(100);
            const result = await authService.revokeSession(longToken);

            expect(logger.debug).toHaveBeenCalledWith('Session revocation requested', {
                service: 'AuthenticationService',
                tokenLength: 100
            });
            expect(result).toBe(true);
        });
    });

    describe('generateSessionToken', () => {
        it('should generate a session token with correct format', () => {
            const token = authService.generateSessionToken();

            expect(token).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(token.length).toBeGreaterThan(20);
        });

        it('should generate unique tokens', () => {
            const token1 = authService.generateSessionToken();
            const token2 = authService.generateSessionToken();

            expect(token1).not.toBe(token2);
        });
    });

    describe('isValidSessionTokenFormat', () => {
        it('should return true for valid session token format', () => {
            const validToken = 'session_1234567890_abcdefghij';

            const result = authService.isValidSessionTokenFormat(validToken);

            expect(result).toBe(true);
        });

        it('should return false for empty token', () => {
            const result = authService.isValidSessionTokenFormat('');

            expect(result).toBe(false);
        });

        it('should return false for null token', () => {
            const result = authService.isValidSessionTokenFormat(null as any);

            expect(result).toBe(false);
        });

        it('should return false for undefined token', () => {
            const result = authService.isValidSessionTokenFormat(undefined as any);

            expect(result).toBe(false);
        });

        it('should return false for non-string token', () => {
            const result = authService.isValidSessionTokenFormat(123 as any);

            expect(result).toBe(false);
        });

        it('should return false for token without session_ prefix', () => {
            const result = authService.isValidSessionTokenFormat('token_1234567890_abcdefghij');

            expect(result).toBe(false);
        });

        it('should return false for token too short', () => {
            const result = authService.isValidSessionTokenFormat('session_12');

            expect(result).toBe(false);
        });

        it('should return true for generated tokens', () => {
            const generatedToken = authService.generateSessionToken();

            const result = authService.isValidSessionTokenFormat(generatedToken);

            expect(result).toBe(true);
        });
    });

    describe('hasPermission with admin permission', () => {
        it('should return true for admin user regardless of specific permission', () => {
            const adminUser: IUserInfo = {
                userId: 'admin-user',
                sessionToken: 'admin-token',
                isAuthenticated: true,
                permissions: ['admin']
            };

            const result = authService.hasPermission(adminUser, 'any_permission');

            expect(result).toBe(true);
        });

        it('should return true for admin user with other permissions too', () => {
            const adminUser: IUserInfo = {
                userId: 'admin-user',
                sessionToken: 'admin-token',
                isAuthenticated: true,
                permissions: ['chat', 'tools', 'admin']
            };

            const result = authService.hasPermission(adminUser, 'special_permission');

            expect(result).toBe(true);
        });
    });

    describe('authenticateUser logging', () => {
        it('should log authentication attempt', async () => {
            await authService.authenticateUser('test-token', 'test-user');

            expect(logger.verbose).toHaveBeenCalledWith('Authentication attempt', {
                service: 'AuthenticationService',
                userId: 'test-user',
                isAuthenticated: true,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools', 'advanced_features', 'file_upload'],
                timestamp: expect.any(String)
            });
        });

        it('should log unauthenticated attempt', async () => {
            await authService.authenticateUser();

            expect(logger.verbose).toHaveBeenCalledWith('Authentication attempt', {
                service: 'AuthenticationService',
                userId: 'anonymous',
                isAuthenticated: false,
                permissions: ['chat', 'content_extraction', 'navigation', 'page_access', 'tab_management', 'tools'],
                timestamp: expect.any(String)
            });
        });
    });
});