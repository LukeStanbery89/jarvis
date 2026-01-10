/**
 * Utility functions for WebSocket operations
 * Common helpers used across the WebSocket system
 */

/**
 * Generate unique message ID
 * Used for tracking WebSocket messages across the system
 */
export function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique session ID
 * Used for conversation and session tracking
 */
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

/**
 * Get server capabilities list
 * Centralized definition of what the WebSocket server can do
 */
export function getServerCapabilities(): string[] {
    return [
        'chat',
        'agent_processing',
        'tool_orchestration',
        'multi_client_support',
        'real_time_status'
    ];
}

/**
 * Validate message ID format
 */
export function isValidMessageId(messageId: string): boolean {
    if (!messageId || typeof messageId !== 'string') {
        return false;
    }
    
    // Check if it matches our message ID format
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
    
    // Check if it matches our session ID format
    const sessionIdRegex = /^session_\d+_[a-z0-9]+$/;
    return sessionIdRegex.test(sessionId);
}

/**
 * Create timestamp in consistent format
 */
export function createTimestamp(): number {
    return Date.now();
}

/**
 * Format timestamp for logging
 */
export function formatTimestampForLog(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Sanitize string for safe logging (remove sensitive data)
 */
export function sanitizeForLogging(text: string, maxLength: number = 100): string {
    if (!text || typeof text !== 'string') {
        return '[invalid string]';
    }
    
    // Remove potential sensitive patterns
    let sanitized = text
        .replace(/api[_\-]?key[_\-:]?\s*[a-zA-Z0-9\-_]{10,}/gi, 'API_KEY_REDACTED')
        .replace(/token[_\-:]?\s*[a-zA-Z0-9\-_]{10,}/gi, 'TOKEN_REDACTED')
        .replace(/password[_\-:]?\s*\S+/gi, 'PASSWORD_REDACTED')
        .replace(/secret[_\-:]?\s*\S+/gi, 'SECRET_REDACTED');
    
    // Truncate if too long
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized;
}

/**
 * Deep clone object for safe manipulation
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }
    
    const cloned: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    
    return cloned as T;
}

/**
 * Check if object has required properties
 */
export function hasRequiredProperties(obj: any, requiredProps: string[]): boolean {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    
    return requiredProps.every(prop => obj.hasOwnProperty(prop));
}

/**
 * Rate limiting helper - simple in-memory rate limiter
 */
export class SimpleRateLimiter {
    private requests = new Map<string, number[]>();
    
    constructor(
        private maxRequests: number,
        private windowMs: number
    ) {}
    
    /**
     * Check if request is allowed for the given identifier
     */
    isAllowed(identifier: string): boolean {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Get existing requests for this identifier
        const userRequests = this.requests.get(identifier) || [];
        
        // Filter out requests outside the current window
        const validRequests = userRequests.filter(time => time > windowStart);
        
        // Check if under the limit
        if (validRequests.length >= this.maxRequests) {
            return false;
        }
        
        // Add current request and update
        validRequests.push(now);
        this.requests.set(identifier, validRequests);
        
        return true;
    }
    
    /**
     * Reset rate limiting for an identifier
     */
    reset(identifier: string): void {
        this.requests.delete(identifier);
    }
    
    /**
     * Clean up old entries (should be called periodically)
     */
    cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        for (const [identifier, requests] of this.requests.entries()) {
            const validRequests = requests.filter(time => time > windowStart);
            if (validRequests.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, validRequests);
            }
        }
    }
}