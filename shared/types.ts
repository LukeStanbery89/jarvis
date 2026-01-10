/**
 * Shared types for WebSocket communication.
 *
 * This file re-exports types from @jarvis/protocol for backward compatibility.
 * Browser-specific storage types remain here as they are not part of the core protocol.
 */

// Re-export all protocol types and utilities
export * from '@jarvis/protocol';

/**
 * Browser-specific storage types (not part of core protocol)
 */

export interface StoredConversation {
    sessionId: string;
    url: string;
    messages: import('@jarvis/protocol').ConversationMessage[];
    lastUpdated: number;
}

export interface StoredPageContext {
    url: string;
    summary: string;
    timestamp: number;
    title: string;
}