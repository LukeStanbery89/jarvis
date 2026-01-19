import { AudioDecoder } from '../src/decoding/AudioDecoder.js';
import { ChunkBuffer } from '../src/decoding/ChunkBuffer.js';
import { serializeChunk } from '../src/encoding/index.js';
import { DEFAULT_AUDIO_FORMAT } from '../src/constants.js';
import { AudioChunk } from '../src/types.js';

function createChunk(sequenceNumber: number, options: Partial<AudioChunk> = {}): AudioChunk {
    return {
        streamId: options.streamId ?? 'test-stream',
        sequenceNumber,
        timestamp: options.timestamp ?? Date.now(),
        format: options.format ?? DEFAULT_AUDIO_FORMAT,
        data: options.data ?? Buffer.from([0x01, 0x02, 0x03, 0x04]),
        durationMs: options.durationMs ?? 100,
        isFinal: options.isFinal ?? false,
    };
}

describe('ChunkBuffer', () => {
    describe('add and getNext', () => {
        it('should return chunks in order', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1));
            buffer.add(createChunk(2));

            expect(buffer.getNext()?.sequenceNumber).toBe(0);
            expect(buffer.getNext()?.sequenceNumber).toBe(1);
            expect(buffer.getNext()?.sequenceNumber).toBe(2);
            expect(buffer.getNext()).toBeNull();
        });

        it('should handle out-of-order chunks', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(2));
            buffer.add(createChunk(0));
            buffer.add(createChunk(1));

            expect(buffer.getNext()?.sequenceNumber).toBe(0);
            expect(buffer.getNext()?.sequenceNumber).toBe(1);
            expect(buffer.getNext()?.sequenceNumber).toBe(2);
        });

        it('should wait for missing chunks', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(2)); // Skip 1

            expect(buffer.getNext()?.sequenceNumber).toBe(0);
            expect(buffer.getNext()).toBeNull(); // Waiting for 1
            expect(buffer.hasNext()).toBe(false);

            buffer.add(createChunk(1));
            expect(buffer.getNext()?.sequenceNumber).toBe(1);
            expect(buffer.getNext()?.sequenceNumber).toBe(2);
        });

        it('should ignore duplicate chunks', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0, { data: Buffer.from([1]) }));
            buffer.add(createChunk(0, { data: Buffer.from([2]) })); // Duplicate

            expect(buffer.size()).toBe(1);
        });

        it('should ignore already-processed sequence numbers', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1));
            buffer.getNext(); // Process 0
            buffer.getNext(); // Process 1

            buffer.add(createChunk(0)); // Old chunk
            buffer.add(createChunk(1)); // Old chunk

            expect(buffer.size()).toBe(0);
        });
    });

    describe('getAvailable', () => {
        it('should return all consecutive chunks', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1));
            buffer.add(createChunk(2));
            buffer.add(createChunk(4)); // Gap at 3

            const available = buffer.getAvailable();

            expect(available.length).toBe(3);
            expect(available.map(c => c.sequenceNumber)).toEqual([0, 1, 2]);
        });
    });

    describe('isComplete', () => {
        it('should return false when no final chunk received', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1));

            expect(buffer.isComplete()).toBe(false);
        });

        it('should return false when final chunk received but not all read', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1, { isFinal: true }));

            expect(buffer.hasFinalChunk()).toBe(true);
            expect(buffer.isComplete()).toBe(false);
        });

        it('should return true when all chunks including final have been read', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1, { isFinal: true }));

            buffer.getNext();
            buffer.getNext();

            expect(buffer.isComplete()).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear all state', () => {
            const buffer = new ChunkBuffer();

            buffer.add(createChunk(0));
            buffer.add(createChunk(1, { isFinal: true }));
            buffer.getNext();

            buffer.reset();

            expect(buffer.size()).toBe(0);
            expect(buffer.getNextExpectedSeq()).toBe(0);
            expect(buffer.hasFinalChunk()).toBe(false);
            expect(buffer.isComplete()).toBe(false);
        });
    });

    describe('buffer overflow', () => {
        it('should prune old chunks when buffer exceeds max size', () => {
            const buffer = new ChunkBuffer(3); // Small buffer

            buffer.add(createChunk(0));
            buffer.add(createChunk(1));
            buffer.add(createChunk(2));
            buffer.add(createChunk(3));
            buffer.add(createChunk(4)); // Should trigger pruning

            expect(buffer.size()).toBeLessThanOrEqual(3);
        });
    });
});

describe('AudioDecoder', () => {
    describe('addChunk', () => {
        it('should accept AudioChunk objects', () => {
            const decoder = new AudioDecoder();
            const chunk = createChunk(0);

            decoder.addChunk(chunk);

            expect(decoder.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
            expect(decoder.getStreamId()).toBe('test-stream');
        });

        it('should accept SerializedAudioChunk objects', () => {
            const decoder = new AudioDecoder();
            const chunk = createChunk(0);
            const serialized = serializeChunk(chunk);

            decoder.addChunk(serialized);

            expect(decoder.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should reset when receiving chunk from different stream', () => {
            const decoder = new AudioDecoder();

            decoder.addChunk(createChunk(0, { streamId: 'stream-1' }));
            decoder.addChunk(createChunk(1, { streamId: 'stream-1' }));
            decoder.addChunk(createChunk(0, { streamId: 'stream-2' })); // New stream

            expect(decoder.getStreamId()).toBe('stream-2');
        });
    });

    describe('createStream', () => {
        it('should return a Readable stream', () => {
            const decoder = new AudioDecoder();
            const stream = decoder.createStream();

            expect(stream).toBeDefined();
            expect(typeof stream.read).toBe('function');
            expect(typeof stream.on).toBe('function');
        });

        it('should return same stream on multiple calls', () => {
            const decoder = new AudioDecoder();
            const stream1 = decoder.createStream();
            const stream2 = decoder.createStream();

            expect(stream1).toBe(stream2);
        });

        it('should push data when chunks are added', (done) => {
            const decoder = new AudioDecoder();
            const stream = decoder.createStream();
            const receivedData: Buffer[] = [];

            stream.on('data', (chunk: Buffer) => {
                receivedData.push(chunk);
            });

            stream.on('end', () => {
                expect(receivedData.length).toBeGreaterThan(0);
                done();
            });

            decoder.addChunk(createChunk(0, { data: Buffer.from([1, 2, 3]) }));
            decoder.addChunk(createChunk(1, { data: Buffer.from([4, 5, 6]), isFinal: true }));
        });

        it('should end stream on final chunk', (done) => {
            const decoder = new AudioDecoder();
            const stream = decoder.createStream();

            stream.on('data', () => {
                // Need a data handler to put stream in flowing mode
            });

            stream.on('end', () => {
                expect(decoder.isComplete()).toBe(true);
                done();
            });

            decoder.addChunk(createChunk(0, { isFinal: true }));
        });
    });

    describe('getFormat', () => {
        it('should return null before any chunks added', () => {
            const decoder = new AudioDecoder();
            expect(decoder.getFormat()).toBeNull();
        });

        it('should return format after first chunk', () => {
            const decoder = new AudioDecoder();
            decoder.addChunk(createChunk(0));

            expect(decoder.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
        });
    });

    describe('isComplete / hasFinalChunk', () => {
        it('should track final chunk status', () => {
            const decoder = new AudioDecoder();

            expect(decoder.hasFinalChunk()).toBe(false);

            decoder.addChunk(createChunk(0));
            expect(decoder.hasFinalChunk()).toBe(false);

            decoder.addChunk(createChunk(1, { isFinal: true }));
            expect(decoder.hasFinalChunk()).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear all state and end existing stream', (done) => {
            const decoder = new AudioDecoder();
            const stream = decoder.createStream();

            decoder.addChunk(createChunk(0));

            stream.on('data', () => {
                // Need a data handler to put stream in flowing mode
            });

            stream.on('end', () => {
                expect(decoder.getFormat()).toBeNull();
                expect(decoder.getStreamId()).toBeNull();
                done();
            });

            decoder.reset();
        });
    });

    describe('getBufferedChunkCount', () => {
        it('should return number of buffered chunks', () => {
            const decoder = new AudioDecoder();

            decoder.addChunk(createChunk(1)); // Out of order, will be buffered
            decoder.addChunk(createChunk(2));

            // Chunk 0 is missing, so 1 and 2 are buffered
            expect(decoder.getBufferedChunkCount()).toBe(2);
        });
    });
});
