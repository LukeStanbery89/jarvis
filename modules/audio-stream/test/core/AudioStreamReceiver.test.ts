import { AudioStreamReceiver } from '../../src/core/AudioStreamReceiver.js';
import { SerializedAudioChunk, DEFAULT_AUDIO_FORMAT } from '@jarvis/audio';
import { StreamStats, ChunkEvent, StreamStartEvent, StreamEndEvent } from '../../src/types.js';

describe('AudioStreamReceiver', () => {
    // Helper to create test chunks
    const createTestChunk = (
        sequenceNumber: number,
        isFinal: boolean = false,
        streamId: string = 'test-stream'
    ): SerializedAudioChunk => ({
        streamId,
        sequenceNumber,
        timestamp: Date.now(),
        format: DEFAULT_AUDIO_FORMAT,
        data: Buffer.alloc(320, 0x80).toString('base64'), // 10ms of audio
        durationMs: 10,
        isFinal,
    });

    describe('constructor', () => {
        it('should create with default config', () => {
            const receiver = new AudioStreamReceiver();
            expect(receiver.getStats().chunkCount).toBe(0);
            expect(receiver.isComplete()).toBe(false);
        });

        it('should create with custom config', () => {
            const droppedChunks: number[][] = [];
            const receiver = new AudioStreamReceiver({
                maxBufferSize: 50,
                onChunksDropped: (seqs) => droppedChunks.push(seqs),
            });

            expect(receiver).toBeDefined();
        });
    });

    describe('addChunk', () => {
        it('should accept and track chunks', () => {
            const receiver = new AudioStreamReceiver();

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1));

            expect(receiver.getStats().chunkCount).toBe(2);
        });

        it('should detect format from first chunk', () => {
            const receiver = new AudioStreamReceiver();

            expect(receiver.getFormat()).toBeNull();

            receiver.addChunk(createTestChunk(0));

            expect(receiver.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should detect streamId from first chunk', () => {
            const receiver = new AudioStreamReceiver();

            expect(receiver.getStreamId()).toBeNull();

            receiver.addChunk(createTestChunk(0, false, 'my-stream'));

            expect(receiver.getStreamId()).toBe('my-stream');
        });

        it('should calculate latency from timestamps', () => {
            const receiver = new AudioStreamReceiver();

            // Create chunk with timestamp in the past
            const chunk = createTestChunk(0);
            chunk.timestamp = Date.now() - 50; // 50ms ago

            receiver.addChunk(chunk);

            const stats = receiver.getStats();
            expect(stats.avgLatencyMs).toBeDefined();
            expect(stats.avgLatencyMs!).toBeGreaterThanOrEqual(40);
        });
    });

    describe('events', () => {
        it('should emit stream:start on first chunk', () => {
            const receiver = new AudioStreamReceiver();

            let startEvent: StreamStartEvent | null = null;
            receiver.on('stream:start', (event: StreamStartEvent) => {
                startEvent = event;
            });

            receiver.addChunk(createTestChunk(0, false, 'test-id'));

            expect(startEvent).not.toBeNull();
            expect(startEvent!.streamId).toBe('test-id');
            expect(startEvent!.format).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should only emit stream:start once', () => {
            const receiver = new AudioStreamReceiver();

            let startCount = 0;
            receiver.on('stream:start', () => {
                startCount++;
            });

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1));
            receiver.addChunk(createTestChunk(2));

            expect(startCount).toBe(1);
        });

        it('should emit chunk events', () => {
            const receiver = new AudioStreamReceiver();

            const chunkEvents: ChunkEvent[] = [];
            receiver.on('chunk', (event: ChunkEvent) => {
                chunkEvents.push(event);
            });

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1));

            expect(chunkEvents.length).toBe(2);
            expect(chunkEvents[0].sequenceNumber).toBe(0);
            expect(chunkEvents[1].sequenceNumber).toBe(1);
        });

        it('should emit stream:end on final chunk', () => {
            const receiver = new AudioStreamReceiver();

            let endEvent: StreamEndEvent | null = null;
            receiver.on('stream:end', (event: StreamEndEvent) => {
                endEvent = event;
            });

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1, true)); // Final

            expect(endEvent).not.toBeNull();
            expect(endEvent!.stats.chunkCount).toBe(2);
        });

        it('should only emit stream:end once', () => {
            const receiver = new AudioStreamReceiver();

            let endCount = 0;
            receiver.on('stream:end', () => {
                endCount++;
            });

            receiver.addChunk(createTestChunk(0, true)); // Final
            // Simulate receiving another final chunk (shouldn't happen normally)
            receiver.addChunk(createTestChunk(1, true));

            expect(endCount).toBe(1);
        });
    });

    describe('getStream', () => {
        it('should return a readable stream', () => {
            const receiver = new AudioStreamReceiver();

            const stream = receiver.getStream();

            expect(stream).toBeDefined();
            expect(stream.readable).toBe(true);
        });

        it('should output PCM data from chunks', (done) => {
            const receiver = new AudioStreamReceiver();
            const stream = receiver.getStream();

            const chunks: Buffer[] = [];
            stream.on('data', (data: Buffer) => {
                chunks.push(data);
            });

            stream.on('end', () => {
                expect(chunks.length).toBeGreaterThan(0);
                done();
            });

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1, true));
        });
    });

    describe('isComplete', () => {
        it('should return false before final chunk', () => {
            const receiver = new AudioStreamReceiver();

            receiver.addChunk(createTestChunk(0));

            expect(receiver.isComplete()).toBe(false);
        });

        it('should return true after final chunk', () => {
            const receiver = new AudioStreamReceiver();

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1, true));

            expect(receiver.isComplete()).toBe(true);
        });
    });

    describe('reset', () => {
        it('should clear all state', () => {
            const receiver = new AudioStreamReceiver();

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1, true));

            expect(receiver.getStats().chunkCount).toBe(2);
            expect(receiver.isComplete()).toBe(true);
            expect(receiver.getStreamId()).toBe('test-stream');

            receiver.reset();

            expect(receiver.getStats().chunkCount).toBe(0);
            expect(receiver.isComplete()).toBe(false);
            expect(receiver.getStreamId()).toBeNull();
            expect(receiver.getFormat()).toBeNull();
            expect(receiver.hasStarted()).toBe(false);
        });

        it('should allow receiving new stream after reset', () => {
            const receiver = new AudioStreamReceiver();

            // First stream
            receiver.addChunk(createTestChunk(0, false, 'stream-1'));
            receiver.addChunk(createTestChunk(1, true, 'stream-1'));

            receiver.reset();

            // Second stream
            let startEvent: StreamStartEvent | null = null;
            receiver.on('stream:start', (event: StreamStartEvent) => {
                startEvent = event;
            });

            receiver.addChunk(createTestChunk(0, false, 'stream-2'));

            expect(receiver.getStreamId()).toBe('stream-2');
            expect(startEvent!.streamId).toBe('stream-2');
        });
    });

    describe('hasStarted', () => {
        it('should return false before any chunks', () => {
            const receiver = new AudioStreamReceiver();
            expect(receiver.hasStarted()).toBe(false);
        });

        it('should return true after first chunk', () => {
            const receiver = new AudioStreamReceiver();
            receiver.addChunk(createTestChunk(0));
            expect(receiver.hasStarted()).toBe(true);
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', () => {
            const receiver = new AudioStreamReceiver();

            receiver.addChunk(createTestChunk(0));
            receiver.addChunk(createTestChunk(1));
            receiver.addChunk(createTestChunk(2, true));

            const stats = receiver.getStats();

            expect(stats.chunkCount).toBe(3);
            expect(stats.byteCount).toBeGreaterThan(0);
            expect(stats.durationMs).toBe(30); // 3 chunks * 10ms each
            expect(stats.startTime).toBeDefined();
            expect(stats.endTime).toBeDefined();
        });

        it('should calculate latency metrics', () => {
            const receiver = new AudioStreamReceiver();

            // Create chunks with different latencies
            const chunk1 = createTestChunk(0);
            chunk1.timestamp = Date.now() - 10;

            const chunk2 = createTestChunk(1);
            chunk2.timestamp = Date.now() - 50;

            const chunk3 = createTestChunk(2, true);
            chunk3.timestamp = Date.now() - 30;

            receiver.addChunk(chunk1);
            receiver.addChunk(chunk2);
            receiver.addChunk(chunk3);

            const stats = receiver.getStats();

            expect(stats.avgLatencyMs).toBeDefined();
            expect(stats.minLatencyMs).toBeDefined();
            expect(stats.maxLatencyMs).toBeDefined();
            expect(stats.maxLatencyMs!).toBeGreaterThanOrEqual(stats.minLatencyMs!);
        });
    });

    describe('stream ID change handling', () => {
        it('should reset on new stream ID', () => {
            const receiver = new AudioStreamReceiver();

            let startCount = 0;
            receiver.on('stream:start', () => {
                startCount++;
            });

            // First stream
            receiver.addChunk(createTestChunk(0, false, 'stream-1'));
            receiver.addChunk(createTestChunk(1, false, 'stream-1'));

            // New stream with different ID - should auto-reset
            receiver.addChunk(createTestChunk(0, false, 'stream-2'));

            expect(receiver.getStreamId()).toBe('stream-2');
            expect(startCount).toBe(2); // Should have emitted start twice
        });
    });
});
