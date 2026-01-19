import { AudioEncoder } from '../src/encoding/AudioEncoder.js';
import { serializeChunk, deserializeChunk } from '../src/encoding/index.js';
import { DEFAULT_AUDIO_FORMAT, getBytesForDuration } from '../src/constants.js';
import { AudioChunk } from '../src/types.js';

describe('AudioEncoder', () => {
    describe('constructor', () => {
        it('should use default values when no config provided', () => {
            const encoder = new AudioEncoder();
            expect(encoder.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
            expect(encoder.getSequenceNumber()).toBe(0);
            expect(encoder.getBufferedBytes()).toBe(0);
            expect(encoder.getStreamId()).toBeDefined();
        });

        it('should accept custom chunk duration', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 50 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 50);

            // Generate enough data for one chunk
            const pcmData = Buffer.alloc(chunkSize);
            const chunks = encoder.encode(pcmData);

            expect(chunks.length).toBe(1);
            expect(chunks[0].durationMs).toBe(50);
        });

        it('should accept custom format', () => {
            const customFormat = {
                sampleRate: 44100,
                channels: 2,
                bitDepth: 16,
                encoding: 's16le' as const,
            };
            const encoder = new AudioEncoder({ format: customFormat });
            expect(encoder.getFormat()).toEqual(customFormat);
        });
    });

    describe('encode', () => {
        it('should return empty array when data is less than chunk size', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const smallData = Buffer.alloc(100); // Much less than 100ms of audio

            const chunks = encoder.encode(smallData);

            expect(chunks).toEqual([]);
            expect(encoder.getBufferedBytes()).toBe(100);
        });

        it('should return chunks when enough data is provided', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize * 2 + 100); // 2 full chunks + remainder

            const chunks = encoder.encode(pcmData);

            expect(chunks.length).toBe(2);
            expect(encoder.getBufferedBytes()).toBe(100);
        });

        it('should assign sequential sequence numbers', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize * 3);

            const chunks = encoder.encode(pcmData);

            expect(chunks[0].sequenceNumber).toBe(0);
            expect(chunks[1].sequenceNumber).toBe(1);
            expect(chunks[2].sequenceNumber).toBe(2);
        });

        it('should use consistent streamId across chunks', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize * 3);

            const chunks = encoder.encode(pcmData);
            const streamId = encoder.getStreamId();

            expect(chunks.every(c => c.streamId === streamId)).toBe(true);
        });

        it('should set isFinal to false for regular chunks', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize * 2);

            const chunks = encoder.encode(pcmData);

            expect(chunks.every(c => c.isFinal === false)).toBe(true);
        });

        it('should include format in each chunk', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize);

            const chunks = encoder.encode(pcmData);

            expect(chunks[0].format).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should preserve PCM data correctly', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize);

            // Fill with recognizable pattern
            for (let i = 0; i < pcmData.length; i++) {
                pcmData[i] = i % 256;
            }

            const chunks = encoder.encode(pcmData);

            expect(chunks[0].data).toEqual(pcmData);
        });
    });

    describe('flush', () => {
        it('should return final chunk with remaining data', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const smallData = Buffer.alloc(500);

            encoder.encode(smallData);
            const finalChunks = encoder.flush();

            expect(finalChunks.length).toBe(1);
            expect(finalChunks[0].isFinal).toBe(true);
            expect(finalChunks[0].data.length).toBe(500);
        });

        it('should return empty final chunk when no remaining data', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize); // Exactly one chunk, no remainder

            encoder.encode(pcmData);
            const finalChunks = encoder.flush();

            expect(finalChunks.length).toBe(1);
            expect(finalChunks[0].isFinal).toBe(true);
            expect(finalChunks[0].data.length).toBe(0);
        });

        it('should continue sequence numbers from encode', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
            const pcmData = Buffer.alloc(chunkSize * 2 + 100);

            const encodeChunks = encoder.encode(pcmData);
            const flushChunks = encoder.flush();

            expect(encodeChunks.length).toBe(2);
            expect(flushChunks[0].sequenceNumber).toBe(2);
        });

        it('should clear the buffer after flush', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            encoder.encode(Buffer.alloc(500));
            encoder.flush();

            expect(encoder.getBufferedBytes()).toBe(0);
        });

        it('should calculate correct duration for partial chunks', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            // 50ms worth of data at 16kHz, 16-bit mono = 1600 bytes
            const partialData = Buffer.alloc(1600);

            encoder.encode(partialData);
            const finalChunks = encoder.flush();

            expect(finalChunks[0].durationMs).toBe(50);
        });
    });

    describe('reset', () => {
        it('should clear buffer and reset sequence number', () => {
            const encoder = new AudioEncoder({ chunkDurationMs: 100 });
            const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);

            encoder.encode(Buffer.alloc(chunkSize * 2 + 100));
            const oldStreamId = encoder.getStreamId();

            encoder.reset();

            expect(encoder.getSequenceNumber()).toBe(0);
            expect(encoder.getBufferedBytes()).toBe(0);
            expect(encoder.getStreamId()).not.toBe(oldStreamId);
        });

        it('should accept custom streamId', () => {
            const encoder = new AudioEncoder();
            const customId = 'my-custom-stream-id';

            encoder.reset(customId);

            expect(encoder.getStreamId()).toBe(customId);
        });
    });
});

describe('serializeChunk / deserializeChunk', () => {
    it('should serialize chunk data to base64', () => {
        const chunk: AudioChunk = {
            streamId: 'test-stream',
            sequenceNumber: 0,
            timestamp: Date.now(),
            format: DEFAULT_AUDIO_FORMAT,
            data: Buffer.from([0x01, 0x02, 0x03, 0x04]),
            durationMs: 100,
            isFinal: false,
        };

        const serialized = serializeChunk(chunk);

        expect(typeof serialized.data).toBe('string');
        expect(serialized.data).toBe('AQIDBA=='); // base64 of [1,2,3,4]
    });

    it('should deserialize back to original chunk', () => {
        const original: AudioChunk = {
            streamId: 'test-stream',
            sequenceNumber: 5,
            timestamp: 1234567890,
            format: DEFAULT_AUDIO_FORMAT,
            data: Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]),
            durationMs: 100,
            isFinal: true,
        };

        const serialized = serializeChunk(original);
        const deserialized = deserializeChunk(serialized);

        expect(deserialized.streamId).toBe(original.streamId);
        expect(deserialized.sequenceNumber).toBe(original.sequenceNumber);
        expect(deserialized.timestamp).toBe(original.timestamp);
        expect(deserialized.format).toEqual(original.format);
        expect(deserialized.data).toEqual(original.data);
        expect(deserialized.durationMs).toBe(original.durationMs);
        expect(deserialized.isFinal).toBe(original.isFinal);
    });

    it('should handle empty data buffer', () => {
        const chunk: AudioChunk = {
            streamId: 'test-stream',
            sequenceNumber: 0,
            timestamp: Date.now(),
            format: DEFAULT_AUDIO_FORMAT,
            data: Buffer.alloc(0),
            durationMs: 0,
            isFinal: true,
        };

        const serialized = serializeChunk(chunk);
        const deserialized = deserializeChunk(serialized);

        expect(deserialized.data.length).toBe(0);
    });
});
