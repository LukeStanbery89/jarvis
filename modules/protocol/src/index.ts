/**
 * @jarvis/protocol
 *
 * Core message types and utilities for WebSocket communication.
 * Shared across server, browser extension, and future hardware nodes.
 */

// Export all message types
export * from './messages';

// Export utility functions
export * from './utils';

/**
 * Protocol version
 */
export const PROTOCOL_VERSION = '1.0.0';
