import { WebSocket } from 'ws';
import { ISocketWrapper, ILogger } from '../types';
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
 */
export function createSocketWrapper(
    ws: WebSocket,
    socketId: string,
    logger?: ILogger
): ISocketWrapper {
    const log = logger || {
        info: () => {},
        warn: () => {},
        error: (message: string, meta?: any) => console.error(message, meta),
        debug: () => {}
    };

    return {
        id: socketId,

        /**
         * Emit an event with data to the client
         * Wraps data in a standard envelope and serializes as JSON
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
                // Wrap in standard envelope
                const envelope: MessageEnvelope = {
                    id: generateMessageId(),
                    type: event,
                    timestamp: Date.now(),
                    payload: data
                };

                const message = JSON.stringify(envelope);
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
