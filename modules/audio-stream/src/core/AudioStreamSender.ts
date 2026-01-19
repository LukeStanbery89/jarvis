import { EventEmitter } from 'events';
import { Readable } from 'stream';
import {
    AudioEncoder,
    AudioFormat,
    DEFAULT_AUDIO_FORMAT,
    serializeChunk,
} from '@jarvis/audio';

import {
    AudioStreamSenderConfig,
    ChunkEmitter,
    StreamStats,
    ChunkEvent,
    StreamStartEvent,
    StreamEndEvent,
    StreamErrorEvent,
} from '../types.js';
import { RealTimePacer, PacedItem } from './RealTimePacer.js';

/**
 * Default chunk duration in milliseconds.
 * 100ms provides a good balance between latency and overhead.
 */
const DEFAULT_CHUNK_DURATION_MS = 100;

/**
 * Transport-agnostic audio stream sender.
 * Encodes PCM audio data and emits serialized chunks via a callback.
 * Can be used with any transport mechanism (WebSocket, HTTP, IPC, etc.).
 *
 * @example
 * ```typescript
 * // Basic usage with WebSocket
 * const sender = new AudioStreamSender();
 * const stats = await sender.send(pcmData, (chunk) => {
 *     ws.send(JSON.stringify(chunk));
 * });
 *
 * // With custom configuration
 * const sender = new AudioStreamSender({
 *     chunkDurationMs: 50,
 *     realTimePacing: true,
 *     format: { sampleRate: 44100, channels: 2, bitDepth: 16, encoding: 's16le' }
 * });
 *
 * // Streaming from a Readable source
 * const stats = await sender.sendFromStream(audioStream, emitter);
 * ```
 *
 * @fires AudioStreamSender#stream:start - When streaming begins
 * @fires AudioStreamSender#chunk - When a chunk is emitted
 * @fires AudioStreamSender#stream:end - When streaming completes
 * @fires AudioStreamSender#error - When an error occurs
 */
export class AudioStreamSender extends EventEmitter {
    private chunkDurationMs: number;
    private format: AudioFormat;
    private realTimePacing: boolean;
    private pacer: RealTimePacer<unknown>;
    private aborted: boolean = false;

    /**
     * Creates a new AudioStreamSender.
     *
     * @param config - Configuration options for chunk duration, format, and pacing
     */
    constructor(config?: AudioStreamSenderConfig) {
        super();
        this.chunkDurationMs = config?.chunkDurationMs ?? DEFAULT_CHUNK_DURATION_MS;
        this.format = config?.format ?? DEFAULT_AUDIO_FORMAT;
        this.realTimePacing = config?.realTimePacing ?? true;
        this.pacer = new RealTimePacer({ enabled: this.realTimePacing });
    }

    /**
     * Streams PCM data, calling the emitter for each serialized chunk.
     * Handles encoding, serialization, and optional real-time pacing.
     *
     * @param pcmData - Raw PCM audio data buffer
     * @param emitter - Callback function to emit each serialized chunk
     * @returns Promise resolving to stream statistics when complete
     */
    async send(pcmData: Buffer, emitter: ChunkEmitter): Promise<StreamStats> {
        this.aborted = false;

        const encoder = new AudioEncoder({
            chunkDurationMs: this.chunkDurationMs,
            format: this.format,
        });

        const startTime = Date.now();
        const stats: StreamStats = {
            chunkCount: 0,
            byteCount: 0,
            durationMs: 0,
            startTime,
        };

        // Encode all chunks
        const audioChunks = encoder.encode(pcmData);
        const finalChunks = encoder.flush();
        const allChunks = [...audioChunks, ...finalChunks];

        if (allChunks.length === 0) {
            stats.endTime = Date.now();
            this.emit('stream:end', { streamId: encoder.getStreamId(), stats } as StreamEndEvent);
            return stats;
        }

        // Emit stream start event
        const streamStartEvent: StreamStartEvent = {
            streamId: allChunks[0].streamId,
            format: this.format,
        };
        this.emit('stream:start', streamStartEvent);

        // Serialize all chunks
        const serializedChunks = allChunks.map(serializeChunk);

        // Prepare paced items
        const pacedItems: PacedItem<typeof serializedChunks[0]>[] = serializedChunks.map(chunk => ({
            item: chunk,
            delayMs: chunk.durationMs,
            isFinal: chunk.isFinal,
        }));

        // Emit chunks with pacing
        for (const { item: chunk, delayMs, isFinal } of pacedItems) {
            if (this.aborted) {
                break;
            }

            // Update timestamp to current time for accurate latency measurement
            const chunkToSend = { ...chunk, timestamp: Date.now() };

            try {
                await emitter(chunkToSend);
            } catch (error) {
                const errorEvent: StreamErrorEvent = {
                    error: error as Error,
                    context: `Failed to emit chunk ${chunk.sequenceNumber}`,
                };
                this.emit('error', errorEvent);
                throw error;
            }

            // Update stats
            stats.chunkCount++;
            stats.byteCount += Buffer.from(chunk.data, 'base64').length;
            stats.durationMs += chunk.durationMs;

            // Emit chunk event
            const chunkEvent: ChunkEvent = {
                sequenceNumber: chunk.sequenceNumber,
                durationMs: chunk.durationMs,
                isFinal: chunk.isFinal,
            };
            this.emit('chunk', chunkEvent);

            // Apply pacing delay (except for final chunk)
            if (!isFinal && this.realTimePacing && delayMs > 0 && !this.aborted) {
                await this.delay(delayMs);
            }
        }

        stats.endTime = Date.now();

        // Emit stream end event
        const streamEndEvent: StreamEndEvent = {
            streamId: allChunks[0].streamId,
            stats,
        };
        this.emit('stream:end', streamEndEvent);

        return stats;
    }

    /**
     * Streams from a Readable source, encoding and emitting chunks as data arrives.
     * Useful for streaming audio from files, microphones, or other sources.
     *
     * @param source - Readable stream of PCM audio data
     * @param emitter - Callback function to emit each serialized chunk
     * @returns Promise resolving to stream statistics when complete
     */
    async sendFromStream(source: Readable, emitter: ChunkEmitter): Promise<StreamStats> {
        this.aborted = false;

        const encoder = new AudioEncoder({
            chunkDurationMs: this.chunkDurationMs,
            format: this.format,
        });

        const startTime = Date.now();
        const stats: StreamStats = {
            chunkCount: 0,
            byteCount: 0,
            durationMs: 0,
            startTime,
        };

        let streamStartEmitted = false;

        return new Promise((resolve, reject) => {
            const processChunks = async (audioChunks: ReturnType<typeof encoder.encode>) => {
                for (const chunk of audioChunks) {
                    if (this.aborted) {
                        return;
                    }

                    // Emit stream start on first chunk
                    if (!streamStartEmitted) {
                        streamStartEmitted = true;
                        const streamStartEvent: StreamStartEvent = {
                            streamId: chunk.streamId,
                            format: this.format,
                        };
                        this.emit('stream:start', streamStartEvent);
                    }

                    const serialized = serializeChunk(chunk);
                    const chunkToSend = { ...serialized, timestamp: Date.now() };

                    try {
                        await emitter(chunkToSend);
                    } catch (error) {
                        const errorEvent: StreamErrorEvent = {
                            error: error as Error,
                            context: `Failed to emit chunk ${chunk.sequenceNumber}`,
                        };
                        this.emit('error', errorEvent);
                        throw error;
                    }

                    // Update stats
                    stats.chunkCount++;
                    stats.byteCount += chunk.data.length;
                    stats.durationMs += chunk.durationMs;

                    // Emit chunk event
                    const chunkEvent: ChunkEvent = {
                        sequenceNumber: chunk.sequenceNumber,
                        durationMs: chunk.durationMs,
                        isFinal: chunk.isFinal,
                    };
                    this.emit('chunk', chunkEvent);

                    // Apply pacing delay (except for final chunk)
                    if (!chunk.isFinal && this.realTimePacing && chunk.durationMs > 0 && !this.aborted) {
                        await this.delay(chunk.durationMs);
                    }
                }
            };

            source.on('data', async (data: Buffer) => {
                source.pause(); // Pause while processing to maintain order
                try {
                    const chunks = encoder.encode(data);
                    await processChunks(chunks);
                } catch (error) {
                    reject(error);
                    return;
                }
                source.resume();
            });

            source.on('end', async () => {
                try {
                    const finalChunks = encoder.flush();
                    await processChunks(finalChunks);

                    stats.endTime = Date.now();

                    // Emit stream end event
                    const streamEndEvent: StreamEndEvent = {
                        streamId: encoder.getStreamId(),
                        stats,
                    };
                    this.emit('stream:end', streamEndEvent);

                    resolve(stats);
                } catch (error) {
                    reject(error);
                }
            });

            source.on('error', (error) => {
                const errorEvent: StreamErrorEvent = {
                    error,
                    context: 'Source stream error',
                };
                this.emit('error', errorEvent);
                reject(error);
            });
        });
    }

    /**
     * Aborts the current send operation.
     * Any pending chunks will not be emitted.
     */
    abort(): void {
        this.aborted = true;
        this.pacer.abort();
    }

    /**
     * Gets the configured audio format.
     *
     * @returns The audio format being used for encoding
     */
    getFormat(): AudioFormat {
        return { ...this.format };
    }

    /**
     * Gets the configured chunk duration.
     *
     * @returns Chunk duration in milliseconds
     */
    getChunkDurationMs(): number {
        return this.chunkDurationMs;
    }

    /**
     * Checks if real-time pacing is enabled.
     *
     * @returns true if pacing is enabled
     */
    isRealTimePacingEnabled(): boolean {
        return this.realTimePacing;
    }

    /**
     * Creates a promise that resolves after the specified delay.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
