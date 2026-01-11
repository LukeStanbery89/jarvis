/**
 * @jarvis/ws-server
 * Platform-agnostic WebSocket server with client management and message routing
 *
 * Usage example:
 * ```typescript
 * import { WebSocketServer, ClientManager, BaseHandler } from '@jarvis/ws-server';
 * import { createServer } from 'http';
 *
 * const httpServer = createServer();
 * const wss = new WebSocketServer(httpServer, {
 *     path: '/ws',
 *     maxConnections: 100
 * }, logger);
 *
 * // Register custom handlers
 * wss.registerHandler(new MyCustomHandler(clientManager));
 *
 * httpServer.listen(3000);
 * ```
 */

// Core classes
export { WebSocketServer } from './WebSocketServer';
export { ClientManager } from './ClientManager';
export { BaseHandler } from './BaseHandler';

// Type definitions
export type {
    IWebSocketServer,
    IWebSocketServerConfig,
    IClientManagerConfig,
    IEventHandler,
    IHandlerContext,
    IClientConnection,
    IClientRegistration,
    ISocketWrapper,
    ILogger,
    IUserInfo
} from './types';

// Export ClientType enum for both type and value access
export { ClientType } from './types';

// Utility functions
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
} from './utils/helpers';

// Socket wrapper utilities
export {
    createSocketWrapper,
    isSocketConnected,
    sendPing,
    MessageEnvelope
} from './utils/socket-wrapper';

// Validation utilities
export {
    isValidMessage,
    validateRegistrationData,
    sanitizeMetadata,
    validateServerConfig,
    IncomingMessage
} from './utils/validation';
