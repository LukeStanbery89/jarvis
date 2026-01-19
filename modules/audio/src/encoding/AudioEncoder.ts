import { randomUUID } from 'crypto';
import { AudioChunk, AudioFormat, AudioEncoderConfig } from '../types.js';
import { DEFAULT_AUDIO_FORMAT, DEFAULT_CHUNK_DURATION_MS, getBytesForDuration, getDurationForBytes } from '../constants.js';

/**
 * Encodes PCM audio data into chunks suitable for network transport.
 * Buffers incoming PCM data and emits fixed-size chunks with metadata.
 */
export class AudioEncoder {
    private streamId: string;
    private sequenceNumber: number = 0;
    private buffer: Buffer = Buffer.alloc(0);
    private chunkDurationMs: number;
    private format: AudioFormat;
    private chunkByteSize: number;

    /**
     * Creates a new AudioEncoder.
     * @param config - Optional configuration for chunk duration and format
     */
    constructor(config?: AudioEncoderConfig) {
        this.chunkDurationMs = config?.chunkDurationMs ?? DEFAULT_CHUNK_DURATION_MS;
        this.format = config?.format ?? DEFAULT_AUDIO_FORMAT;
        this.chunkByteSize = getBytesForDuration(this.format, this.chunkDurationMs);
        this.streamId = randomUUID();
    }

    /**
     * Encodes PCM data into audio chunks.
     * Buffers the data and returns complete chunks of the configured duration.
     * @param pcmData - Raw PCM audio data
     * @returns Array of audio chunks (may be empty if not enough data yet)
     */
    encode(pcmData: Buffer): AudioChunk[] {
        // Append new data to buffer
        this.buffer = Buffer.concat([this.buffer, pcmData]);

        const chunks: AudioChunk[] = [];

        // Extract complete chunks
        while (this.buffer.length >= this.chunkByteSize) {
            const chunkData = this.buffer.subarray(0, this.chunkByteSize);
            this.buffer = this.buffer.subarray(this.chunkByteSize);

            chunks.push({
                streamId: this.streamId,
                sequenceNumber: this.sequenceNumber++,
                timestamp: Date.now(),
                format: { ...this.format },
                data: Buffer.from(chunkData),
                durationMs: this.chunkDurationMs,
                isFinal: false,
            });
        }

        return chunks;
    }

    /**
     * Flushes any remaining buffered data as final chunk(s).
     * Should be called when the audio stream ends.
     * @returns Array of final chunks with isFinal=true on the last one
     */
    flush(): AudioChunk[] {
        const chunks: AudioChunk[] = [];

        // If there's remaining data, emit it as a shorter final chunk
        if (this.buffer.length > 0) {
            const durationMs = getDurationForBytes(this.format, this.buffer.length);

            chunks.push({
                streamId: this.streamId,
                sequenceNumber: this.sequenceNumber++,
                timestamp: Date.now(),
                format: { ...this.format },
                data: Buffer.from(this.buffer),
                durationMs,
                isFinal: true,
            });

            this.buffer = Buffer.alloc(0);
        } else {
            // Emit an empty final marker chunk if no remaining data
            chunks.push({
                streamId: this.streamId,
                sequenceNumber: this.sequenceNumber++,
                timestamp: Date.now(),
                format: { ...this.format },
                data: Buffer.alloc(0),
                durationMs: 0,
                isFinal: true,
            });
        }

        return chunks;
    }

    /**
     * Resets the encoder for a new audio stream.
     * @param streamId - Optional custom stream ID (generates UUID if not provided)
     */
    reset(streamId?: string): void {
        this.streamId = streamId ?? randomUUID();
        this.sequenceNumber = 0;
        this.buffer = Buffer.alloc(0);
    }

    /**
     * Gets the current stream ID.
     */
    getStreamId(): string {
        return this.streamId;
    }

    /**
     * Gets the configured audio format.
     */
    getFormat(): AudioFormat {
        return { ...this.format };
    }

    /**
     * Gets the current sequence number (next chunk will have this number).
     */
    getSequenceNumber(): number {
        return this.sequenceNumber;
    }

    /**
     * Gets the amount of data currently buffered (in bytes).
     */
    getBufferedBytes(): number {
        return this.buffer.length;
    }
}
