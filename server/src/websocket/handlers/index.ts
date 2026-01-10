/**
 * Handler registry and factory
 * Centralized management of WebSocket event handlers
 */

export { RegistrationHandler } from './RegistrationHandler';
export { ChatHandler } from './ChatHandler';
export { PingHandler } from './PingHandler';
export { BaseHandler } from './BaseHandler';

// Handler registry for easy access
export const HANDLER_REGISTRY = {
    'client_registration': 'RegistrationHandler',
    'chat_message': 'ChatHandler',
    'ping': 'PingHandler'
} as const;