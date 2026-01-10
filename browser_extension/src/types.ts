/**
 * Browser extension specific types.
 * These types are for local storage and browser-specific functionality.
 */

import type { ConversationMessage } from '@jarvis/protocol';

/**
 * Stored conversation data in browser local storage
 */
export interface StoredConversation {
    sessionId: string;
    url: string;
    messages: ConversationMessage[];
    lastUpdated: number;
}

/**
 * Stored page context in browser local storage
 */
export interface StoredPageContext {
    url: string;
    summary: string;
    timestamp: number;
    title: string;
}
