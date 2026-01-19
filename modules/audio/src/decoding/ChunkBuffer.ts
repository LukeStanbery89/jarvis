import { AudioChunk } from '../types.js';
import { DEFAULT_MAX_BUFFER_SIZE } from '../constants.js';

/**
 * Buffers audio chunks and provides them in order.
 * Handles out-of-order delivery and gaps in sequence numbers.
 */
export class ChunkBuffer {
    private chunks: Map<number, AudioChunk> = new Map();
    private nextExpectedSeq: number = 0;
    private maxBufferSize: number;
    private streamComplete: boolean = false;
    private finalSeqNumber: number = -1;

    /**
     * Creates a new ChunkBuffer.
     * @param maxBufferSize - Maximum number of chunks to buffer before dropping old ones
     */
    constructor(maxBufferSize: number = DEFAULT_MAX_BUFFER_SIZE) {
        this.maxBufferSize = maxBufferSize;
    }

    /**
     * Adds a chunk to the buffer.
     * @param chunk - The audio chunk to add
     */
    add(chunk: AudioChunk): void {
        // Don't add chunks we've already processed
        if (chunk.sequenceNumber < this.nextExpectedSeq) {
            return;
        }

        // Check for final chunk
        if (chunk.isFinal) {
            this.streamComplete = true;
            this.finalSeqNumber = chunk.sequenceNumber;
        }

        this.chunks.set(chunk.sequenceNumber, chunk);

        // If buffer is full, remove oldest unprocessed chunks
        if (this.chunks.size > this.maxBufferSize) {
            this.pruneBuffer();
        }
    }

    /**
     * Gets the next chunk in sequence if available.
     * @returns The next chunk, or null if not available yet
     */
    getNext(): AudioChunk | null {
        const chunk = this.chunks.get(this.nextExpectedSeq);
        if (chunk) {
            this.chunks.delete(this.nextExpectedSeq);
            this.nextExpectedSeq++;
            return chunk;
        }
        return null;
    }

    /**
     * Gets all available chunks in order, up to any gap.
     * @returns Array of chunks in sequence order
     */
    getAvailable(): AudioChunk[] {
        const result: AudioChunk[] = [];
        let chunk: AudioChunk | null;
        while ((chunk = this.getNext()) !== null) {
            result.push(chunk);
        }
        return result;
    }

    /**
     * Checks if there are chunks ready to be read.
     */
    hasNext(): boolean {
        return this.chunks.has(this.nextExpectedSeq);
    }

    /**
     * Checks if the stream is complete (final chunk received and all chunks read).
     */
    isComplete(): boolean {
        if (!this.streamComplete) {
            return false;
        }
        // Complete when we've read past the final sequence number
        return this.nextExpectedSeq > this.finalSeqNumber;
    }

    /**
     * Checks if the final chunk has been received.
     */
    hasFinalChunk(): boolean {
        return this.streamComplete;
    }

    /**
     * Gets the number of chunks currently buffered.
     */
    size(): number {
        return this.chunks.size;
    }

    /**
     * Gets the next expected sequence number.
     */
    getNextExpectedSeq(): number {
        return this.nextExpectedSeq;
    }

    /**
     * Resets the buffer for a new stream.
     */
    reset(): void {
        this.chunks.clear();
        this.nextExpectedSeq = 0;
        this.streamComplete = false;
        this.finalSeqNumber = -1;
    }

    /**
     * Prunes the buffer by removing oldest chunks when over capacity.
     */
    private pruneBuffer(): void {
        // Find the oldest sequence numbers and remove them
        const seqNumbers = Array.from(this.chunks.keys()).sort((a, b) => a - b);
        const toRemove = seqNumbers.length - this.maxBufferSize;

        for (let i = 0; i < toRemove; i++) {
            this.chunks.delete(seqNumbers[i]);
        }

        // Update nextExpectedSeq if we skipped chunks
        if (seqNumbers.length > toRemove) {
            const lowestRemaining = seqNumbers[toRemove];
            if (lowestRemaining > this.nextExpectedSeq) {
                this.nextExpectedSeq = lowestRemaining;
            }
        }
    }
}
