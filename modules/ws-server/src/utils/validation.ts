/**
 * Validation utilities for WebSocket messages and client data
 */

import { IClientManagerConfig } from '../types';

/**
 * Incoming WebSocket message structure
 */
export interface IncomingMessage {
    type: string;
    id?: string;
    timestamp?: number;
    [key: string]: unknown;
}

/**
 * Type guard to validate incoming message structure
 */
export function isValidMessage(data: unknown): data is IncomingMessage {
    return (
        data !== null &&
        typeof data === 'object' &&
        'type' in data &&
        typeof (data as any).type === 'string' &&
        (data as any).type.length > 0 &&
        (data as any).type.length < 100
    );
}

/**
 * Validate client registration data
 * Throws error if validation fails
 */
export function validateRegistrationData(
    capabilities: string[],
    userAgent: string | undefined,
    metadata: Record<string, any> | undefined,
    config: Required<IClientManagerConfig>
): void {
    // Validate capabilities
    if (!Array.isArray(capabilities)) {
        throw new Error('Capabilities must be an array');
    }

    if (capabilities.length > config.maxCapabilities) {
        throw new Error(`Too many capabilities (max: ${config.maxCapabilities})`);
    }

    // Validate each capability is a non-empty string
    for (const capability of capabilities) {
        if (typeof capability !== 'string' || capability.length === 0) {
            throw new Error('Each capability must be a non-empty string');
        }
        if (capability.length > 100) {
            throw new Error('Capability name too long (max: 100 characters)');
        }
    }

    // Validate user agent
    if (userAgent !== undefined) {
        if (typeof userAgent !== 'string') {
            throw new Error('User agent must be a string');
        }
        if (userAgent.length > config.maxUserAgentLength) {
            throw new Error(`User agent too long (max: ${config.maxUserAgentLength} characters)`);
        }
    }

    // Validate metadata
    if (metadata !== undefined) {
        if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
            throw new Error('Metadata must be an object');
        }

        const metadataSize = JSON.stringify(metadata).length;
        if (metadataSize > config.maxMetadataSize) {
            throw new Error(`Metadata too large (max: ${config.maxMetadataSize} bytes)`);
        }

        // Check for prototype pollution attempts (check own properties, not inherited)
        if (
            metadata.hasOwnProperty('__proto__') ||
            metadata.hasOwnProperty('constructor') ||
            metadata.hasOwnProperty('prototype')
        ) {
            throw new Error('Invalid metadata: prototype pollution attempt detected');
        }
    }
}

/**
 * Sanitize metadata to prevent injection attacks
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
        // Skip dangerous keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }

        // Only allow simple types
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value === null
        ) {
            sanitized[key] = value;
        } else if (Array.isArray(value)) {
            // Allow arrays of simple types
            sanitized[key] = value.filter(
                item =>
                    typeof item === 'string' ||
                    typeof item === 'number' ||
                    typeof item === 'boolean' ||
                    item === null
            );
        } else if (typeof value === 'object' && value !== null) {
            // Recursively sanitize nested objects (limited depth)
            sanitized[key] = sanitizeMetadata(value);
        }
    }

    return sanitized;
}

/**
 * Validate WebSocket server configuration
 */
export function validateServerConfig(config: any): void {
    if (config.maxConnections !== undefined) {
        if (typeof config.maxConnections !== 'number' || config.maxConnections < 0) {
            throw new Error('maxConnections must be a non-negative number');
        }
    }

    if (config.pingInterval !== undefined) {
        if (typeof config.pingInterval !== 'number' || config.pingInterval < 1000) {
            throw new Error('pingInterval must be >= 1000ms');
        }
    }

    if (config.clientTimeout !== undefined) {
        if (typeof config.clientTimeout !== 'number' || config.clientTimeout < 1000) {
            throw new Error('clientTimeout must be >= 1000ms');
        }
    }
}
