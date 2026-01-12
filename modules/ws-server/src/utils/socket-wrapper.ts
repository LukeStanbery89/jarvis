import { WebSocket } from 'ws';
import { ISocketWrapper, ILogger, MessageFormat } from '../types';
import { generateMessageId } from './helpers';

/**
 * Message envelope structure for consistent message format
 */
export interface MessageEnvelope<T = unknown> {
    id: string;
    type: string;
    timestamp: number;
    payload: T;
}

/**
 * Create a socket wrapper that converts raw WebSocket to Socket.io-like API
 * Provides a consistent interface for emitting events and disconnecting
 *
 * @param ws - Raw WebSocket connection
 * @param socketId - Unique socket identifier
 * @param messageFormat - Message format to use ('envelope' or 'legacy')
 * @param logger - Optional logger for debugging
 */
export function createSocketWrapper(
    ws: WebSocket,
    socketId: string,
    // third param may be either MessageFormat or ILogger for historical callers
    messageFormatOrLogger: MessageFormat | ILogger = 'envelope',
    logger?: ILogger
): ISocketWrapper {
    // Resolve arguments: allow calling (ws, id, logger) or (ws, id, format, logger)
    let messageFormat: MessageFormat = 'envelope';
    let resolvedLogger: ILogger | undefined = undefined;

    if (typeof messageFormatOrLogger === 'string') {
        messageFormat = messageFormatOrLogger;
        resolvedLogger = logger;
    } else if (typeof messageFormatOrLogger === 'object' && messageFormatOrLogger !== null) {
        resolvedLogger = messageFormatOrLogger as ILogger;
    }

    const log = resolvedLogger || {
        info: () => { },
        warn: () => { },
        error: (message: string, meta?: any) => console.error(message, meta),
        debug: () => { }
    };

    return {
        id: socketId,

        /**
         * Emit an event with data to the client
         * Supports both envelope and legacy message formats
         */
        emit(event: string, data: unknown): void {
            if (ws.readyState !== WebSocket.OPEN) {
                log.debug('Cannot emit to closed socket', {
                    socketId,
                    event,
                    readyState: ws.readyState
                });
                return;
            }

            try {
                let message: string;

                if (messageFormat === 'legacy') {
                    // Legacy format: spread data at root with type field
                    const legacyMessage = typeof data === 'object' && data !== null
                        ? { ...data as Record<string, unknown>, type: event }
                        : { type: event, data };
                    message = JSON.stringify(legacyMessage);
                } else {
                    // Envelope format: structured message with metadata
                    const envelope: MessageEnvelope = {
                        id: generateMessageId(),
                        type: event,
                        timestamp: Date.now(),
                        payload: data
                    };
                    message = JSON.stringify(envelope);
                }

                ws.send(message);
            } catch (error) {
                log.error('Failed to send message', {
                    socketId,
                    event,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        },

        /**
         * Disconnect the WebSocket connection
         */
        disconnect(): void {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        }
    };
}

/**
 * Check if a WebSocket is still connected
 */
export function isSocketConnected(ws: WebSocket): boolean {
    return ws.readyState === WebSocket.OPEN;
}

/**
 * Send a ping message to check connection health
 */
export function sendPing(ws: WebSocket): boolean {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.ping();
            return true;
        } catch (error) {
            return false;
        }
    }
    return false;
}
