import { Readable } from 'stream';
import { AudioChunk, AudioFormat, AudioDecoderConfig, SerializedAudioChunk } from '../types.js';
import { DEFAULT_MAX_BUFFER_SIZE } from '../constants.js';
import { ChunkBuffer } from './ChunkBuffer.js';
import { deserializeChunk, isSerializedChunk } from '../encoding/index.js';

/**
 * Decodes audio chunks back into a playable PCM stream.
 * Handles buffering, ordering, and creates a Readable stream for playback.
 * Respects stream backpressure to prevent memory buildup.
 */
export class AudioDecoder {
    private buffer: ChunkBuffer;
    private format: AudioFormat | null = null;
    private stream: Readable | null = null;
    private streamId: string | null = null;
    private streamEnded: boolean = false;

    /**
     * Creates a new AudioDecoder.
     * @param config - Optional configuration for buffer size and callbacks
     */
    constructor(config?: AudioDecoderConfig) {
        this.buffer = new ChunkBuffer({
            maxBufferSize: config?.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE,
            onChunksDropped: config?.onChunksDropped,
        });
    }

    /**
     * Adds a chunk to the decoder.
     * Accepts both raw AudioChunk and SerializedAudioChunk (auto-deserializes).
     * @param chunk - The audio chunk to add
     */
    addChunk(chunk: AudioChunk | SerializedAudioChunk): void {
        // Deserialize if needed
        const audioChunk = isSerializedChunk(chunk) ? deserializeChunk(chunk) : chunk;

        // Capture format and streamId from first chunk
        if (this.format === null) {
            this.format = { ...audioChunk.format };
            this.streamId = audioChunk.streamId;
        }

        // Verify chunk belongs to the same stream
        if (audioChunk.streamId !== this.streamId) {
            // Different stream - reset and start fresh
            this.reset();
            this.format = { ...audioChunk.format };
            this.streamId = audioChunk.streamId;
        }

        this.buffer.add(audioChunk);

        // Push available data to stream if one exists
        this.pushAvailableData();
    }

    /**
     * Creates a Readable stream for playback.
     * The stream will receive PCM data as chunks are added.
     * @returns Readable stream of PCM audio data
     */
    createStream(): Readable {
        if (this.stream) {
            return this.stream;
        }

        this.stream = new Readable({
            read: () => {
                // Push any available data when read is called (backpressure relieved)
                this.pushAvailableData();
            }
        });

        // Push any already-buffered data
        this.pushAvailableData();

        return this.stream;
    }

    /**
     * Gets the audio format from the decoded chunks.
     * @returns The audio format, or null if no chunks have been received
     */
    getFormat(): AudioFormat | null {
        return this.format ? { ...this.format } : null;
    }

    /**
     * Gets the stream ID from the decoded chunks.
     * @returns The stream ID, or null if no chunks have been received
     */
    getStreamId(): string | null {
        return this.streamId;
    }

    /**
     * Checks if all chunks have been received (final chunk received).
     */
    isComplete(): boolean {
        return this.buffer.isComplete();
    }

    /**
     * Checks if the final chunk has been received.
     */
    hasFinalChunk(): boolean {
        return this.buffer.hasFinalChunk();
    }

    /**
     * Gets the number of chunks currently buffered.
     */
    getBufferedChunkCount(): number {
        return this.buffer.size();
    }

    /**
     * Resets the decoder for a new stream.
     */
    reset(): void {
        // End existing stream if any
        if (this.stream && !this.streamEnded) {
            this.stream.push(null);
        }
        this.stream = null;
        this.streamEnded = false;

        this.buffer.reset();
        this.format = null;
        this.streamId = null;
    }

    /**
     * Pushes available data from buffer to stream, respecting backpressure.
     * Only consumes chunks from buffer if stream can accept them.
     */
    private pushAvailableData(): void {
        if (!this.stream || this.streamEnded) {
            return;
        }

        // Keep pushing while there are chunks and stream can accept data
        while (this.buffer.hasNext()) {
            const chunk = this.buffer.peekNext();
            if (!chunk) {
                break;
            }

            // Try to push data
            let canContinue = true;
            if (chunk.data.length > 0) {
                canContinue = this.stream.push(chunk.data);
            }

            // Only consume the chunk after successful push
            this.buffer.getNext();

            // End stream on final chunk
            if (chunk.isFinal) {
                this.stream.push(null);
                this.streamEnded = true;
                return;
            }

            // Stop if backpressure detected - _read() will call us again
            if (!canContinue) {
                return;
            }
        }
    }
}
