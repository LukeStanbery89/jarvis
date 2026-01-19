import { EventEmitter } from 'events';
import { Readable } from 'stream';
import {
    AudioDecoder,
    AudioFormat,
    SerializedAudioChunk,
} from '@jarvis/audio';

import {
    AudioStreamReceiverConfig,
    StreamStats,
    ChunkEvent,
    StreamStartEvent,
    StreamEndEvent,
    StreamErrorEvent,
} from '../types.js';

/**
 * Default maximum buffer size in chunks.
 */
const DEFAULT_MAX_BUFFER_SIZE = 100;

/**
 * Transport-agnostic audio stream receiver.
 * Receives serialized audio chunks and produces a PCM Readable stream.
 * Can be fed chunks from any transport mechanism (WebSocket, HTTP, IPC, etc.).
 *
 * @example
 * ```typescript
 * // Basic usage
 * const receiver = new AudioStreamReceiver();
 *
 * receiver.on('stream:start', ({ streamId, format }) => {
 *     console.log(`Stream started: ${streamId}`);
 *     const stream = receiver.getStream();
 *     player.playStream(stream, format);
 * });
 *
 * // Feed chunks as they arrive
 * ws.on('message', (data) => {
 *     const chunk = JSON.parse(data);
 *     receiver.addChunk(chunk);
 * });
 *
 * // Wait for stream completion
 * receiver.on('stream:end', ({ stats }) => {
 *     console.log(`Received ${stats.chunkCount} chunks`);
 * });
 * ```
 *
 * @fires AudioStreamReceiver#stream:start - When the first chunk is received
 * @fires AudioStreamReceiver#chunk - When a chunk is processed
 * @fires AudioStreamReceiver#stream:end - When the final chunk is received
 * @fires AudioStreamReceiver#error - When an error occurs
 */
export class AudioStreamReceiver extends EventEmitter {
    private decoder: AudioDecoder;
    private maxBufferSize: number;
    private onChunksDropped?: (droppedSequenceNumbers: number[]) => void;
    private stats: StreamStats;
    private latencies: number[] = [];
    private streamStartEmitted: boolean = false;
    private streamEndEmitted: boolean = false;
    private startTime: number | null = null;

    /**
     * Creates a new AudioStreamReceiver.
     *
     * @param config - Configuration options for buffer size and callbacks
     */
    constructor(config?: AudioStreamReceiverConfig) {
        super();
        this.maxBufferSize = config?.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
        this.onChunksDropped = config?.onChunksDropped;

        this.decoder = new AudioDecoder({
            maxBufferSize: this.maxBufferSize,
            onChunksDropped: this.onChunksDropped,
        });

        this.stats = this.createEmptyStats();
    }

    /**
     * Feeds a received serialized chunk to the receiver.
     * Handles deserialization internally and updates statistics.
     *
     * @param chunk - The serialized audio chunk to process
     */
    addChunk(chunk: SerializedAudioChunk): void {
        const receiveTime = Date.now();

        try {
            // Check if this is a new stream (different stream ID)
            const currentStreamId = this.getStreamId();
            const isNewStream = currentStreamId !== null && currentStreamId !== chunk.streamId;

            if (isNewStream) {
                // Reset for new stream
                this.reset();
            }

            // Track first chunk for stream start event
            if (!this.streamStartEmitted) {
                this.streamStartEmitted = true;
                this.startTime = receiveTime;
                this.stats.startTime = receiveTime;

                const streamStartEvent: StreamStartEvent = {
                    streamId: chunk.streamId,
                    format: chunk.format,
                };
                this.emit('stream:start', streamStartEvent);
            }

            // Add chunk to decoder
            this.decoder.addChunk(chunk);

            // Calculate latency from chunk timestamp
            const latency = receiveTime - chunk.timestamp;
            this.latencies.push(latency);

            // Update stats
            this.stats.chunkCount++;
            this.stats.byteCount += Buffer.from(chunk.data, 'base64').length;
            this.stats.durationMs += chunk.durationMs;

            // Emit chunk event
            const chunkEvent: ChunkEvent = {
                sequenceNumber: chunk.sequenceNumber,
                durationMs: chunk.durationMs,
                isFinal: chunk.isFinal,
            };
            this.emit('chunk', chunkEvent);

            // Handle final chunk
            if (chunk.isFinal && !this.streamEndEmitted) {
                this.streamEndEmitted = true;
                this.stats.endTime = receiveTime;
                this.updateLatencyStats();

                const streamEndEvent: StreamEndEvent = {
                    streamId: chunk.streamId,
                    stats: this.getStats(),
                };
                this.emit('stream:end', streamEndEvent);
            }
        } catch (error) {
            const errorEvent: StreamErrorEvent = {
                error: error as Error,
                context: `Failed to process chunk ${chunk.sequenceNumber}`,
            };
            this.emit('error', errorEvent);
        }
    }

    /**
     * Gets the PCM output stream.
     * The stream receives decoded audio data as chunks are added.
     *
     * @returns Readable stream of PCM audio data
     */
    getStream(): Readable {
        return this.decoder.createStream();
    }

    /**
     * Gets the detected audio format from received chunks.
     *
     * @returns The audio format, or null if no chunks have been received
     */
    getFormat(): AudioFormat | null {
        return this.decoder.getFormat();
    }

    /**
     * Gets the current stream ID.
     *
     * @returns The stream ID, or null if no chunks have been received
     */
    getStreamId(): string | null {
        return this.decoder.getStreamId();
    }

    /**
     * Checks if the stream is complete (final chunk received).
     *
     * @returns true if the final chunk has been received
     */
    isComplete(): boolean {
        return this.streamEndEmitted;
    }

    /**
     * Resets the receiver for a new stream.
     * Clears all buffered data and statistics.
     */
    reset(): void {
        this.decoder.reset();
        this.stats = this.createEmptyStats();
        this.latencies = [];
        this.streamStartEmitted = false;
        this.streamEndEmitted = false;
        this.startTime = null;
    }

    /**
     * Gets current stream statistics.
     * Includes chunk counts, byte counts, duration, and latency metrics.
     *
     * @returns Current stream statistics
     */
    getStats(): StreamStats {
        this.updateLatencyStats();
        return { ...this.stats };
    }

    /**
     * Gets the number of chunks currently buffered in the decoder.
     *
     * @returns Number of buffered chunks
     */
    getBufferedChunkCount(): number {
        return this.decoder.getBufferedChunkCount();
    }

    /**
     * Checks if the stream start event has been emitted.
     *
     * @returns true if stream has started
     */
    hasStarted(): boolean {
        return this.streamStartEmitted;
    }

    /**
     * Creates an empty stats object.
     */
    private createEmptyStats(): StreamStats {
        return {
            chunkCount: 0,
            byteCount: 0,
            durationMs: 0,
        };
    }

    /**
     * Updates latency statistics from collected latency measurements.
     */
    private updateLatencyStats(): void {
        if (this.latencies.length === 0) {
            return;
        }

        const sum = this.latencies.reduce((a, b) => a + b, 0);
        this.stats.avgLatencyMs = sum / this.latencies.length;
        this.stats.minLatencyMs = Math.min(...this.latencies);
        this.stats.maxLatencyMs = Math.max(...this.latencies);
    }
}
