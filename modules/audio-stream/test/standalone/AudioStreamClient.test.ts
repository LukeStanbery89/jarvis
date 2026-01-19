import { AudioStreamClient } from '../../src/standalone/AudioStreamClient.js';
import { AudioStreamServer } from '../../src/standalone/AudioStreamServer.js';
import { DEFAULT_AUDIO_FORMAT, AudioFormat, SerializedAudioChunk } from '@jarvis/audio';
import { StreamStartEvent, StreamEndEvent } from '../../src/types.js';
import { Readable } from 'stream';

describe('AudioStreamClient', () => {
    // Generate test PCM data
    const generateTestPcm = (durationMs: number): Buffer => {
        const bytesPerMs = (DEFAULT_AUDIO_FORMAT.sampleRate * DEFAULT_AUDIO_FORMAT.bitDepth / 8) / 1000;
        const bytes = Math.floor(bytesPerMs * durationMs);
        return Buffer.alloc(bytes, 0x80);
    };

    const TEST_PORT = 19877;
    let server: AudioStreamServer;
    let client: AudioStreamClient;

    beforeEach(async () => {
        server = new AudioStreamServer({
            port: TEST_PORT,
            senderConfig: { realTimePacing: false },
        });
        await server.start();
    });

    afterEach(async () => {
        if (client) {
            client.disconnect();
        }
        if (server) {
            await server.stop();
        }
    });

    describe('constructor', () => {
        it('should create client with config', () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            expect(client.getState()).toBe('disconnected');
            expect(client.isConnected()).toBe(false);
        });

        it('should apply default config values', () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            // Can't directly check config, but can verify it doesn't throw
            expect(client).toBeDefined();
        });
    });

    describe('connect/disconnect', () => {
        it('should connect to server', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();

            expect(client.isConnected()).toBe(true);
            expect(client.getState()).toBe('connected');
        });

        it('should emit connected event', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            let connectedEmitted = false;
            client.on('connected', () => {
                connectedEmitted = true;
            });

            await client.connect();

            expect(connectedEmitted).toBe(true);
        });

        it('should disconnect cleanly', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            client.disconnect();

            expect(client.getState()).toBe('disconnected');
            expect(client.isConnected()).toBe(false);
        });

        it('should emit disconnected event', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();

            const disconnectedPromise = new Promise<void>((resolve) => {
                client.on('disconnected', resolve);
            });

            client.disconnect();

            await disconnectedPromise;
        });

        it.skip('should handle connection failure', async () => {
            client = new AudioStreamClient({
                url: 'ws://127.0.0.1:19999', // Wrong port
                autoReconnect: false,
            });

            await expect(client.connect()).rejects.toThrow();
        });
    });

    describe('receiving audio', () => {
        it('should receive and process chunks', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();

            // Wait for server to register connection
            await new Promise(resolve => setTimeout(resolve, 50));

            const clientIds = server.getConnectedClients();
            expect(clientIds.length).toBe(1);

            const chunkEvents: { sequenceNumber: number }[] = [];
            client.on('stream:chunk', (event) => {
                chunkEvents.push(event);
            });

            // Stream from server
            const pcmData = generateTestPcm(200);
            await server.streamToClient(clientIds[0], pcmData);

            // Wait for chunks to arrive
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(chunkEvents.length).toBeGreaterThan(0);
        });

        it('should emit stream:start event', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            const startPromise = new Promise<StreamStartEvent>((resolve) => {
                client.on('stream:start', resolve);
            });

            const pcmData = generateTestPcm(100);
            server.streamToClient(server.getConnectedClients()[0], pcmData);

            const event = await startPromise;

            expect(event.streamId).toBeDefined();
            expect(event.format).toEqual(DEFAULT_AUDIO_FORMAT);
        });

        it('should emit stream:end event', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            const endPromise = new Promise<StreamEndEvent>((resolve) => {
                client.on('stream:end', resolve);
            });

            const pcmData = generateTestPcm(100);
            await server.streamToClient(server.getConnectedClients()[0], pcmData);

            const event = await endPromise;

            expect(event.streamId).toBeDefined();
            expect(event.stats.chunkCount).toBeGreaterThan(0);
        });
    });

    describe('onStream', () => {
        it('should call callback with stream details', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            let receivedStreamId: string | null = null;
            let receivedFormat: AudioFormat | null = null;
            let receivedStream: Readable | null = null;

            client.onStream((streamId, format, stream) => {
                receivedStreamId = streamId;
                receivedFormat = format;
                receivedStream = stream;
            });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            const pcmData = generateTestPcm(100);
            server.streamToClient(server.getConnectedClients()[0], pcmData);

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedStreamId).toBeDefined();
            expect(receivedFormat).toEqual(DEFAULT_AUDIO_FORMAT);
            expect(receivedStream).toBeDefined();
        });
    });

    describe('waitForStream', () => {
        it('should resolve when stream completes', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            const statsPromise = client.waitForStream();

            const pcmData = generateTestPcm(100);
            await server.streamToClient(server.getConnectedClients()[0], pcmData);

            const stats = await statsPromise;

            expect(stats.chunkCount).toBeGreaterThan(0);
        });

        it('should reject when disconnected', async () => {
            client = new AudioStreamClient({
                url: `ws://127.0.0.1:${TEST_PORT}`,
                autoReconnect: false,
            });

            await client.connect();

            const statsPromise = client.waitForStream();

            // Disconnect before stream completes
            client.disconnect();

            await expect(statsPromise).rejects.toThrow('Client disconnected');
        });
    });

    describe('getStream/getFormat', () => {
        it('should return null before stream starts', () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            expect(client.getStream()).toBeNull();
            expect(client.getFormat()).toBeNull();
        });

        it('should return values after stream starts', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Wait for first chunk
            const startPromise = new Promise<void>((resolve) => {
                client.on('stream:start', resolve);
            });

            const pcmData = generateTestPcm(100);
            server.streamToClient(server.getConnectedClients()[0], pcmData);

            await startPromise;

            expect(client.getStream()).not.toBeNull();
            expect(client.getFormat()).toEqual(DEFAULT_AUDIO_FORMAT);
        });
    });

    describe('resetReceiver', () => {
        it('should clear receiver state', async () => {
            client = new AudioStreamClient({ url: `ws://127.0.0.1:${TEST_PORT}` });

            await client.connect();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Receive a stream
            const pcmData = generateTestPcm(100);
            await server.streamToClient(server.getConnectedClients()[0], pcmData);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(client.getStats().chunkCount).toBeGreaterThan(0);

            // Reset
            client.resetReceiver();

            expect(client.getStats().chunkCount).toBe(0);
            expect(client.getFormat()).toBeNull();
        });
    });

    describe('auto-reconnect', () => {
        it('should attempt reconnection when enabled', async () => {
            client = new AudioStreamClient({
                url: `ws://127.0.0.1:${TEST_PORT}`,
                autoReconnect: true,
                maxReconnectAttempts: 3,
                reconnectDelayMs: 50,
            });

            await client.connect();

            let reconnectingCount = 0;
            client.on('reconnecting', () => {
                reconnectingCount++;
            });

            // Listen for errors to prevent unhandled errors during reconnection
            const errors: Error[] = [];
            client.on('error', (event) => {
                errors.push(event.error);
            });

            // Stop server to trigger disconnect
            await server.stop();

            // Wait for reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(reconnectingCount).toBeGreaterThan(0);
        });

        it('should not reconnect when disabled', async () => {
            client = new AudioStreamClient({
                url: `ws://127.0.0.1:${TEST_PORT}`,
                autoReconnect: false,
            });

            await client.connect();

            let reconnectingCount = 0;
            client.on('reconnecting', () => {
                reconnectingCount++;
            });

            // Stop server to trigger disconnect
            await server.stop();

            // Wait to ensure no reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(reconnectingCount).toBe(0);
        });
    });
});
