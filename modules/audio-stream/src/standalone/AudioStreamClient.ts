import { EventEmitter } from 'events';
import { Readable } from 'stream';
import WebSocket from 'ws';
import { AudioFormat, SerializedAudioChunk } from '@jarvis/audio';

import {
    AudioStreamClientConfig,
    StreamStats,
    StreamStartEvent,
    StreamEndEvent,
    StreamErrorEvent,
} from '../types.js';
import { AudioStreamReceiver } from '../core/AudioStreamReceiver.js';

/**
 * Connection state for the client.
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Callback type for stream events.
 */
type StreamCallback = (streamId: string, format: AudioFormat, stream: Readable) => void;

/**
 * WebSocket client wrapper around AudioStreamReceiver.
 * Provides a high-level API for receiving audio streams over WebSocket.
 * Supports automatic reconnection with exponential backoff.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const client = new AudioStreamClient({ url: 'ws://127.0.0.1:8080' });
 *
 * client.onStream((streamId, format, stream) => {
 *     console.log(`Receiving stream: ${streamId}`);
 *     // Process the PCM stream
 * });
 *
 * await client.connect();
 *
 * // Wait for a complete stream
 * const stats = await client.waitForStream();
 * console.log(`Received ${stats.chunkCount} chunks`);
 *
 * // Cleanup
 * client.disconnect();
 * ```
 *
 * @fires AudioStreamClient#connected - When connection is established
 * @fires AudioStreamClient#disconnected - When connection is lost
 * @fires AudioStreamClient#reconnecting - When attempting to reconnect
 * @fires AudioStreamClient#stream:start - When a new stream begins
 * @fires AudioStreamClient#stream:chunk - When a chunk is received
 * @fires AudioStreamClient#stream:end - When a stream completes
 * @fires AudioStreamClient#error - When an error occurs
 */
export class AudioStreamClient extends EventEmitter {
    protected config: AudioStreamClientConfig;
    protected ws: WebSocket | null = null;
    protected receiver: AudioStreamReceiver;
    protected state: ConnectionState = 'disconnected';
    protected reconnectAttempts: number = 0;
    protected reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    protected streamCallbacks: StreamCallback[] = [];
    protected currentStreamPromise: {
        resolve: (stats: StreamStats) => void;
        reject: (error: Error) => void;
    } | null = null;

    /**
     * Creates a new AudioStreamClient.
     *
     * @param config - Client configuration including URL and reconnection options
     */
    constructor(config: AudioStreamClientConfig) {
        super();
        this.config = {
            autoReconnect: true,
            maxReconnectAttempts: 5,
            reconnectDelayMs: 1000,
            ...config,
        };

        this.receiver = new AudioStreamReceiver(this.config.receiverConfig);
        this.setupReceiverEvents();
    }

    /**
     * Connects to the WebSocket server.
     *
     * @returns Promise that resolves when connected
     */
    async connect(): Promise<void> {
        if (this.state === 'connected' || this.state === 'connecting') {
            return;
        }

        this.state = 'connecting';
        this.reconnectAttempts = 0;

        return this.createConnection();
    }

    /**
     * Disconnects from the WebSocket server.
     * Cancels any pending reconnection attempts.
     */
    disconnect(): void {
        const wasConnected = this.state === 'connected';
        this.state = 'disconnected';

        // Cancel any pending reconnection
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Close the WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Emit disconnected event if we were connected
        if (wasConnected) {
            this.emit('disconnected', { code: 1000, reason: 'Client disconnected' });
        }

        // Reject any pending stream promise
        if (this.currentStreamPromise) {
            this.currentStreamPromise.reject(new Error('Client disconnected'));
            this.currentStreamPromise = null;
        }
    }

    /**
     * Checks if the client is connected.
     *
     * @returns true if connected to the server
     */
    isConnected(): boolean {
        return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Gets the current connection state.
     *
     * @returns The connection state
     */
    getState(): ConnectionState {
        return this.state;
    }

    /**
     * Gets the PCM output stream from the current audio stream.
     *
     * @returns Readable stream of PCM data, or null if no stream is active
     */
    getStream(): Readable | null {
        if (!this.receiver.hasStarted()) {
            return null;
        }
        return this.receiver.getStream();
    }

    /**
     * Gets the audio format from the current stream.
     *
     * @returns Audio format, or null if no stream is active
     */
    getFormat(): AudioFormat | null {
        return this.receiver.getFormat();
    }

    /**
     * Gets current stream statistics.
     *
     * @returns Stream statistics
     */
    getStats(): StreamStats {
        return this.receiver.getStats();
    }

    /**
     * Waits for the current or next audio stream to complete.
     *
     * @returns Promise resolving to stream statistics when complete
     */
    waitForStream(): Promise<StreamStats> {
        // If stream is already complete, return stats immediately
        if (this.receiver.isComplete()) {
            return Promise.resolve(this.receiver.getStats());
        }

        // Create a promise that will resolve when the stream ends
        return new Promise((resolve, reject) => {
            this.currentStreamPromise = { resolve, reject };
        });
    }

    /**
     * Registers a callback to be called when a new stream starts.
     * The callback receives the stream ID, format, and PCM Readable stream.
     *
     * @param callback - Function to call when a stream starts
     */
    onStream(callback: StreamCallback): void {
        this.streamCallbacks.push(callback);
    }

    /**
     * Resets the receiver for a new stream.
     * Call this to prepare for receiving a new stream on the same connection.
     */
    resetReceiver(): void {
        this.receiver.reset();
    }

    /**
     * Creates a new WebSocket connection.
     */
    protected createConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.config.url);

            this.ws.on('open', () => {
                this.state = 'connected';
                this.reconnectAttempts = 0;
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.RawData) => {
                this.handleMessage(data);
            });

            this.ws.on('close', (code, reason) => {
                const wasConnected = this.state === 'connected';
                this.ws = null;

                // If we were connecting and got a close event without opening, it's a connection failure
                if (this.state === 'connecting' && !wasConnected) {
                    this.state = 'disconnected';
                    reject(new Error(`Connection failed with code ${code}: ${reason}`));
                    return;
                }

                if (this.state !== 'disconnected') {
                    this.emit('disconnected', { code, reason: reason?.toString() });
                }

                // Attempt reconnection if enabled and we were previously connected
                if (wasConnected && this.config.autoReconnect && this.state !== 'disconnected') {
                    this.attemptReconnect();
                } else if (this.state !== 'disconnected') {
                    this.state = 'disconnected';
                }
            });

            this.ws.on('error', (error) => {
                const errorEvent: StreamErrorEvent = {
                    error,
                    context: 'WebSocket error',
                };
                this.emit('error', errorEvent);

                // Reject the promise on connection errors
                if (this.state === 'connecting' || this.state === 'reconnecting') {
                    this.state = 'disconnected';
                    reject(error);
                }
            });
        });
    }

    /**
     * Handles incoming WebSocket messages.
     */
    protected handleMessage(data: WebSocket.RawData): void {
        try {
            const jsonStr = data.toString();
            const chunk = JSON.parse(jsonStr) as SerializedAudioChunk;

            // Check if this is a new stream (different stream ID or receiver not started)
            const currentStreamId = this.receiver.getStreamId();
            if (currentStreamId !== null && currentStreamId !== chunk.streamId) {
                // New stream - reset the receiver
                this.receiver.reset();
            }

            // If this is the first chunk, notify stream callbacks
            if (!this.receiver.hasStarted()) {
                const stream = this.receiver.getStream();
                const format = chunk.format;

                // Notify all registered callbacks
                for (const callback of this.streamCallbacks) {
                    try {
                        callback(chunk.streamId, format, stream);
                    } catch (error) {
                        const errorEvent: StreamErrorEvent = {
                            error: error as Error,
                            context: 'Stream callback error',
                        };
                        this.emit('error', errorEvent);
                    }
                }
            }

            // Add chunk to receiver
            this.receiver.addChunk(chunk);

            // Emit chunk event
            this.emit('stream:chunk', {
                sequenceNumber: chunk.sequenceNumber,
                durationMs: chunk.durationMs,
                isFinal: chunk.isFinal,
            });
        } catch (error) {
            const errorEvent: StreamErrorEvent = {
                error: error as Error,
                context: 'Failed to parse message',
            };
            this.emit('error', errorEvent);
        }
    }

    /**
     * Attempts to reconnect with exponential backoff.
     */
    protected attemptReconnect(): void {
        if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 5)) {
            this.state = 'disconnected';
            const errorEvent: StreamErrorEvent = {
                error: new Error('Max reconnection attempts exceeded'),
                context: 'Reconnection failed',
            };
            this.emit('error', errorEvent);
            return;
        }

        this.state = 'reconnecting';
        this.reconnectAttempts++;

        // Calculate delay with exponential backoff
        const baseDelay = this.config.reconnectDelayMs ?? 1000;
        const delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);

        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            try {
                await this.createConnection();
            } catch {
                // Connection failed, attemptReconnect will be called from close handler
            }
        }, delay);
    }

    /**
     * Sets up event forwarding from the receiver.
     */
    protected setupReceiverEvents(): void {
        this.receiver.on('stream:start', (event: StreamStartEvent) => {
            this.emit('stream:start', event);
        });

        this.receiver.on('stream:end', (event: StreamEndEvent) => {
            this.emit('stream:end', event);

            // Resolve any pending stream promise
            if (this.currentStreamPromise) {
                this.currentStreamPromise.resolve(event.stats);
                this.currentStreamPromise = null;
            }
        });

        this.receiver.on('error', (event: StreamErrorEvent) => {
            this.emit('error', event);
        });
    }
}
