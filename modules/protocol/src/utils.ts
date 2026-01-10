/**
 * Utility functions for protocol operations.
 * Shared across all components for consistent ID generation and validation.
 */

/**
 * Generate unique message ID
 * Format: msg_{timestamp}_{random}
 */
export function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique session ID
 * Format: session_{timestamp}_{random}
 */
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

/**
 * Generate unique execution ID for tool execution tracking
 * Format: exec_{timestamp}_{random}
 */
export function generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate message ID format
 */
export function isValidMessageId(messageId: string): boolean {
    if (!messageId || typeof messageId !== 'string') {
        return false;
    }

    const messageIdRegex = /^msg_\d+_[a-z0-9]+$/;
    return messageIdRegex.test(messageId);
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
        return false;
    }

    const sessionIdRegex = /^session_\d+_[a-z0-9]+$/;
    return sessionIdRegex.test(sessionId);
}

/**
 * Validate execution ID format
 */
export function isValidExecutionId(executionId: string): boolean {
    if (!executionId || typeof executionId !== 'string') {
        return false;
    }

    const executionIdRegex = /^exec_\d+_[a-z0-9]+$/;
    return executionIdRegex.test(executionId);
}

/**
 * Create timestamp in consistent format (milliseconds since epoch)
 */
export function createTimestamp(): number {
    return Date.now();
}
