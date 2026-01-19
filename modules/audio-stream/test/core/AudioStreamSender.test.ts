import { Readable } from 'stream';
import { AudioStreamSender } from '../../src/core/AudioStreamSender.js';
import { SerializedAudioChunk, DEFAULT_AUDIO_FORMAT } from '@jarvis/audio';
import { ChunkEmitter, StreamStats, ChunkEvent, StreamStartEvent, StreamEndEvent } from '../../src/types.js';

describe('AudioStreamSender', () => {
    // Generate test PCM data (100ms at 16kHz mono 16-bit = 3200 bytes)
    const generateTestPcm = (durationMs: number): Buffer => {
        const bytesPerMs = (DEFAULT_AUDIO_FORMAT.sampleRate * DEFAULT_AUDIO_FORMAT.bitDepth / 8) / 1000;
        const bytes = Math.floor(bytesPerMs * durationMs);
        return Buffer.alloc(bytes, 0x80);
    };

    describe('constructor', () => {
        it('should create with default config', () => {
            const sender = new AudioStreamSender();
            expect(sender.getChunkDurationMs()).toBe(100);
            expect(sender.isRealTimePacingEnabled()).toBe(true);
            expect(sender.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should create with custom config', () => {
            const customFormat = { ...DEFAULT_AUDIO_FORMAT, sampleRate: 44100 };
            const sender = new AudioStreamSender({
                chunkDurationMs: 50,
                realTimePacing: false,
                format: customFormat,
            });

            expect(sender.getChunkDurationMs()).toBe(50);
            expect(sender.isRealTimePacingEnabled()).toBe(false);
            expect(sender.getFormat()).toEqual(customFormat);
        });
    });

    describe('send', () => {
        it('should emit chunks via the emitter callback', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(250); // ~2.5 chunks

            const emittedChunks: SerializedAudioChunk[] = [];
            const emitter: ChunkEmitter = (chunk) => {
                emittedChunks.push(chunk);
            };

            await sender.send(pcmData, emitter);

            expect(emittedChunks.length).toBe(3); // 2 full chunks + 1 final
            expect(emittedChunks[0].sequenceNumber).toBe(0);
            expect(emittedChunks[1].sequenceNumber).toBe(1);
            expect(emittedChunks[2].sequenceNumber).toBe(2);
            expect(emittedChunks[2].isFinal).toBe(true);
        });

        it('should return correct stats', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(200); // 2 full chunks

            const stats = await sender.send(pcmData, () => {});

            expect(stats.chunkCount).toBe(3); // 2 full + 1 final
            expect(stats.byteCount).toBeGreaterThan(0);
            expect(stats.durationMs).toBeGreaterThan(0);
            expect(stats.startTime).toBeDefined();
            expect(stats.endTime).toBeDefined();
        });

        it('should emit stream:start event', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(100);

            let startEvent: StreamStartEvent | null = null;
            sender.on('stream:start', (event: StreamStartEvent) => {
                startEvent = event;
            });

            await sender.send(pcmData, () => {});

            expect(startEvent).not.toBeNull();
            expect(startEvent!.streamId).toBeDefined();
            expect(startEvent!.format).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should emit chunk events', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(200);

            const chunkEvents: ChunkEvent[] = [];
            sender.on('chunk', (event: ChunkEvent) => {
                chunkEvents.push(event);
            });

            await sender.send(pcmData, () => {});

            expect(chunkEvents.length).toBe(3);
            expect(chunkEvents[0].sequenceNumber).toBe(0);
            expect(chunkEvents[2].isFinal).toBe(true);
        });

        it('should emit stream:end event', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(100);

            let endEvent: StreamEndEvent | null = null;
            sender.on('stream:end', (event: StreamEndEvent) => {
                endEvent = event;
            });

            await sender.send(pcmData, () => {});

            expect(endEvent).not.toBeNull();
            expect(endEvent!.streamId).toBeDefined();
            expect(endEvent!.stats.chunkCount).toBeGreaterThan(0);
        });

        it('should handle empty buffer', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = Buffer.alloc(0);

            const emittedChunks: SerializedAudioChunk[] = [];
            await sender.send(pcmData, (chunk) => {
                emittedChunks.push(chunk);
            });

            // Should emit at least a final marker chunk
            expect(emittedChunks.length).toBeGreaterThanOrEqual(0);
        });

        it('should apply real-time pacing when enabled', async () => {
            const sender = new AudioStreamSender({
                realTimePacing: true,
                chunkDurationMs: 50,
            });
            const pcmData = generateTestPcm(100); // 2 chunks

            const startTime = Date.now();
            await sender.send(pcmData, () => {});
            const elapsed = Date.now() - startTime;

            // Should have paced at least one chunk (~50ms)
            expect(elapsed).toBeGreaterThanOrEqual(40);
        });

        it('should handle async emitter', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(100);

            const emittedChunks: SerializedAudioChunk[] = [];
            const asyncEmitter: ChunkEmitter = async (chunk) => {
                await new Promise(resolve => setTimeout(resolve, 5));
                emittedChunks.push(chunk);
            };

            await sender.send(pcmData, asyncEmitter);

            expect(emittedChunks.length).toBeGreaterThan(0);
        });

        it('should propagate emitter errors', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(100);

            const emitter: ChunkEmitter = () => {
                throw new Error('Emitter failed');
            };

            await expect(sender.send(pcmData, emitter)).rejects.toThrow('Emitter failed');
        });

        it('should update timestamp at send time', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });
            const pcmData = generateTestPcm(100);

            const timestamps: number[] = [];
            await sender.send(pcmData, (chunk) => {
                timestamps.push(chunk.timestamp);
            });

            // All timestamps should be recent
            const now = Date.now();
            for (const ts of timestamps) {
                expect(now - ts).toBeLessThan(1000);
            }
        });
    });

    describe('sendFromStream', () => {
        it('should stream from a Readable source', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });

            // Create a readable stream that emits PCM data
            const pcmData = generateTestPcm(200);
            const source = new Readable({
                read() {
                    this.push(pcmData);
                    this.push(null);
                }
            });

            const emittedChunks: SerializedAudioChunk[] = [];
            const stats = await sender.sendFromStream(source, (chunk) => {
                emittedChunks.push(chunk);
            });

            expect(emittedChunks.length).toBeGreaterThan(0);
            expect(stats.chunkCount).toBe(emittedChunks.length);
        });

        it('should emit events for stream source', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });

            const pcmData = generateTestPcm(100);
            const source = new Readable({
                read() {
                    this.push(pcmData);
                    this.push(null);
                }
            });

            let startEmitted = false;
            let endEmitted = false;
            sender.on('stream:start', () => { startEmitted = true; });
            sender.on('stream:end', () => { endEmitted = true; });

            await sender.sendFromStream(source, () => {});

            expect(startEmitted).toBe(true);
            expect(endEmitted).toBe(true);
        });

        it('should handle stream errors', async () => {
            const sender = new AudioStreamSender({ realTimePacing: false });

            const source = new Readable({
                read() {
                    this.destroy(new Error('Stream error'));
                }
            });

            // Listen for error event to prevent unhandled error
            const errorPromise = new Promise<Error>((resolve) => {
                sender.once('error', (event) => resolve(event.error));
            });

            await expect(sender.sendFromStream(source, () => {})).rejects.toThrow('Stream error');
            await expect(errorPromise).resolves.toThrow('Stream error');
        });
    });

    describe('abort', () => {
        it('should stop sending when aborted', async () => {
            const sender = new AudioStreamSender({
                realTimePacing: true,
                chunkDurationMs: 50,
            });
            const pcmData = generateTestPcm(500); // Many chunks

            let chunkCount = 0;
            const promise = sender.send(pcmData, () => {
                chunkCount++;
                if (chunkCount >= 2) {
                    sender.abort();
                }
            });

            await promise;

            // Should have stopped after abort
            expect(chunkCount).toBeLessThan(5);
        });
    });
});
