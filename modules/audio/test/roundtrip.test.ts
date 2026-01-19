import { AudioEncoder } from '../src/encoding/AudioEncoder.js';
import { AudioDecoder } from '../src/decoding/AudioDecoder.js';
import { serializeChunk, deserializeChunk } from '../src/encoding/index.js';
import { DEFAULT_AUDIO_FORMAT, getBytesForDuration } from '../src/constants.js';

describe('Round-trip encode/decode', () => {
    it('should preserve data through encode → serialize → deserialize → decode', (done) => {
        const encoder = new AudioEncoder({ chunkDurationMs: 100 });
        const decoder = new AudioDecoder();

        // Create recognizable PCM data pattern
        const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
        const pcmData = Buffer.alloc(chunkSize * 3 + 500); // 3 full chunks + partial
        for (let i = 0; i < pcmData.length; i++) {
            pcmData[i] = i % 256;
        }

        // Encode
        const chunks = encoder.encode(pcmData);
        const finalChunks = encoder.flush();
        const allChunks = [...chunks, ...finalChunks];

        // Serialize (simulate network)
        const serialized = allChunks.map(serializeChunk);

        // Deserialize and decode
        for (const chunk of serialized) {
            decoder.addChunk(deserializeChunk(chunk));
        }

        // Collect output
        const stream = decoder.createStream();
        const outputChunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => {
            outputChunks.push(chunk);
        });

        stream.on('end', () => {
            const outputData = Buffer.concat(outputChunks);

            expect(outputData.length).toBe(pcmData.length);
            expect(outputData.equals(pcmData)).toBe(true);
            done();
        });
    });

    it('should handle out-of-order chunk delivery', (done) => {
        const encoder = new AudioEncoder({ chunkDurationMs: 100 });
        const decoder = new AudioDecoder();

        const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);
        const pcmData = Buffer.alloc(chunkSize * 5);
        for (let i = 0; i < pcmData.length; i++) {
            pcmData[i] = i % 256;
        }

        // Encode
        const chunks = encoder.encode(pcmData);
        const finalChunks = encoder.flush();
        const allChunks = [...chunks, ...finalChunks];

        // Serialize
        const serialized = allChunks.map(serializeChunk);

        // Shuffle to simulate out-of-order delivery (but keep final chunk last)
        const shuffled = [...serialized.slice(0, -1)].sort(() => Math.random() - 0.5);
        shuffled.push(serialized[serialized.length - 1]);

        // Add chunks in shuffled order
        for (const chunk of shuffled) {
            decoder.addChunk(chunk);
        }

        // Collect output
        const stream = decoder.createStream();
        const outputChunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => {
            outputChunks.push(chunk);
        });

        stream.on('end', () => {
            const outputData = Buffer.concat(outputChunks);

            expect(outputData.length).toBe(pcmData.length);
            expect(outputData.equals(pcmData)).toBe(true);
            done();
        });
    });

    it('should work with serialized chunks passed directly to decoder', (done) => {
        const encoder = new AudioEncoder({ chunkDurationMs: 50 });
        const decoder = new AudioDecoder();

        const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 50);
        const pcmData = Buffer.alloc(chunkSize * 2);
        for (let i = 0; i < pcmData.length; i++) {
            pcmData[i] = (i * 7) % 256; // Different pattern
        }

        // Encode and serialize
        const chunks = encoder.encode(pcmData);
        const finalChunks = encoder.flush();
        const serialized = [...chunks, ...finalChunks].map(serializeChunk);

        // Decoder should auto-deserialize
        for (const chunk of serialized) {
            decoder.addChunk(chunk); // Pass serialized directly
        }

        const stream = decoder.createStream();
        const outputChunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => {
            outputChunks.push(chunk);
        });

        stream.on('end', () => {
            const outputData = Buffer.concat(outputChunks);
            expect(outputData.equals(pcmData)).toBe(true);
            done();
        });
    });

    it('should handle multiple streams sequentially', () => {
        const encoder = new AudioEncoder({ chunkDurationMs: 100 });
        const decoder = new AudioDecoder();

        const chunkSize = getBytesForDuration(DEFAULT_AUDIO_FORMAT, 100);

        // First stream
        const pcmData1 = Buffer.alloc(chunkSize);
        pcmData1.fill(0xAA);

        const chunks1 = encoder.encode(pcmData1);
        chunks1.push(...encoder.flush());

        for (const chunk of chunks1) {
            decoder.addChunk(chunk);
        }

        expect(decoder.getStreamId()).toBe(encoder.getStreamId());
        const stream1Id = encoder.getStreamId();

        // Reset encoder for new stream
        encoder.reset();

        // Second stream
        const pcmData2 = Buffer.alloc(chunkSize);
        pcmData2.fill(0xBB);

        const chunks2 = encoder.encode(pcmData2);
        chunks2.push(...encoder.flush());

        for (const chunk of chunks2) {
            decoder.addChunk(chunk);
        }

        expect(decoder.getStreamId()).toBe(encoder.getStreamId());
        expect(decoder.getStreamId()).not.toBe(stream1Id);
    });

    it('should preserve format through round-trip', () => {
        const customFormat = {
            sampleRate: 44100,
            channels: 2,
            bitDepth: 16,
            encoding: 's16le' as const,
        };

        const encoder = new AudioEncoder({ chunkDurationMs: 100, format: customFormat });
        const decoder = new AudioDecoder();

        const chunkSize = getBytesForDuration(customFormat, 100);
        const pcmData = Buffer.alloc(chunkSize);

        const chunks = encoder.encode(pcmData);
        chunks.push(...encoder.flush());

        const serialized = chunks.map(serializeChunk);

        for (const chunk of serialized) {
            decoder.addChunk(chunk);
        }

        expect(decoder.getFormat()).toEqual(customFormat);
    });
});
