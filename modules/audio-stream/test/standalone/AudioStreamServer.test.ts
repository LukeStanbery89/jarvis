import { AudioStreamServer } from '../../src/standalone/AudioStreamServer.js';
import { DEFAULT_AUDIO_FORMAT } from '@jarvis/audio';
import { ClientConnectEvent, ClientDisconnectEvent, StreamStartEvent, StreamEndEvent } from '../../src/types.js';
import WebSocket from 'ws';

describe('AudioStreamServer', () => {
    // Generate test PCM data
    const generateTestPcm = (durationMs: number): Buffer => {
        const bytesPerMs = (DEFAULT_AUDIO_FORMAT.sampleRate * DEFAULT_AUDIO_FORMAT.bitDepth / 8) / 1000;
        const bytes = Math.floor(bytesPerMs * durationMs);
        return Buffer.alloc(bytes, 0x80);
    };

    let server: AudioStreamServer;
    const TEST_PORT = 19876;

    afterEach(async () => {
        if (server) {
            await server.stop();
        }
    });

    describe('constructor', () => {
        it('should create server with config', () => {
            server = new AudioStreamServer({ port: TEST_PORT });
            expect(server.getPort()).toBe(TEST_PORT);
            expect(server.isServerRunning()).toBe(false);
        });
    });

    describe('start/stop', () => {
        it('should start and stop the server', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });

            expect(server.isServerRunning()).toBe(false);

            await server.start();
            expect(server.isServerRunning()).toBe(true);

            await server.stop();
            expect(server.isServerRunning()).toBe(false);
        });

        it('should handle multiple start calls', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });

            await server.start();
            await server.start(); // Should be a no-op

            expect(server.isServerRunning()).toBe(true);
        });

        it('should handle multiple stop calls', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });

            await server.start();
            await server.stop();
            await server.stop(); // Should be a no-op

            expect(server.isServerRunning()).toBe(false);
        });
    });

    describe('client connections', () => {
        it('should track connected clients', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });
            await server.start();

            expect(server.getConnectedClients()).toEqual([]);
            expect(server.getClientCount()).toBe(0);

            // Connect a client
            const clientConnected = new Promise<string>((resolve) => {
                server.on('client:connect', ({ clientId }: ClientConnectEvent) => {
                    resolve(clientId);
                });
            });

            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

            // Wait for WebSocket to open
            await new Promise<void>((resolve) => {
                ws.on('open', resolve);
            });

            const clientId = await clientConnected;

            expect(server.getConnectedClients()).toContain(clientId);
            expect(server.getClientCount()).toBe(1);
            expect(server.isClientConnected(clientId)).toBe(true);

            ws.close();
        });

        it('should emit client:connect event', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });
            await server.start();

            const connectPromise = new Promise<ClientConnectEvent>((resolve) => {
                server.on('client:connect', resolve);
            });

            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

            // Wait for WebSocket to open
            await new Promise<void>((resolve) => {
                ws.on('open', resolve);
            });

            const event = await connectPromise;

            expect(event.clientId).toMatch(/^client-\d+$/);

            ws.close();
        });

        it('should emit client:disconnect event', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });
            await server.start();

            let connectedClientId: string;
            server.on('client:connect', ({ clientId }: ClientConnectEvent) => {
                connectedClientId = clientId;
            });

            const disconnectPromise = new Promise<ClientDisconnectEvent>((resolve) => {
                server.on('client:disconnect', resolve);
            });

            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
            await new Promise<void>((resolve) => ws.on('open', resolve));

            ws.close();

            const event = await disconnectPromise;

            expect(event.clientId).toBe(connectedClientId!);
            expect(server.isClientConnected(connectedClientId!)).toBe(false);
        });
    });

    describe('streamToClient', () => {
        it('should stream audio to a connected client', async () => {
            server = new AudioStreamServer({
                port: TEST_PORT,
                senderConfig: { realTimePacing: false },
            });
            await server.start();

            // Connect client and wait for connection
            const clientConnected = new Promise<string>((resolve) => {
                server.on('client:connect', ({ clientId }: ClientConnectEvent) => {
                    resolve(clientId);
                });
            });

            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
            await new Promise<void>((resolve) => ws.on('open', resolve));

            const clientId = await clientConnected;

            // Collect received chunks
            const receivedChunks: unknown[] = [];
            ws.on('message', (data) => {
                receivedChunks.push(JSON.parse(data.toString()));
            });

            // Stream audio
            const pcmData = generateTestPcm(200);
            const stats = await server.streamToClient(clientId, pcmData);

            // Wait a bit for messages to arrive
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(stats.chunkCount).toBeGreaterThan(0);
            expect(receivedChunks.length).toBe(stats.chunkCount);

            ws.close();
        });

        it('should throw error for non-existent client', async () => {
            server = new AudioStreamServer({ port: TEST_PORT });
            await server.start();

            const pcmData = generateTestPcm(100);

            await expect(server.streamToClient('non-existent', pcmData))
                .rejects.toThrow('Client not connected');
        });

        it('should emit stream events', async () => {
            server = new AudioStreamServer({
                port: TEST_PORT,
                senderConfig: { realTimePacing: false },
            });
            await server.start();

            const clientConnected = new Promise<string>((resolve) => {
                server.on('client:connect', ({ clientId }: ClientConnectEvent) => {
                    resolve(clientId);
                });
            });

            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
            await new Promise<void>((resolve) => ws.on('open', resolve));

            const clientId = await clientConnected;

            let startEvent: (StreamStartEvent & { clientId: string }) | null = null;
            let endEvent: (StreamEndEvent & { clientId: string }) | null = null;

            server.on('stream:start', (event) => {
                startEvent = event;
            });
            server.on('stream:end', (event) => {
                endEvent = event;
            });

            const pcmData = generateTestPcm(100);
            await server.streamToClient(clientId, pcmData);

            expect(startEvent).not.toBeNull();
            expect(startEvent!.clientId).toBe(clientId);
            expect(startEvent!.streamId).toBeDefined();

            expect(endEvent).not.toBeNull();
            expect(endEvent!.clientId).toBe(clientId);
            expect(endEvent!.stats.chunkCount).toBeGreaterThan(0);

            ws.close();
        });
    });

    describe('streamToAll', () => {
        it('should stream to all connected clients', async () => {
            server = new AudioStreamServer({
                port: TEST_PORT,
                senderConfig: { realTimePacing: false },
            });
            await server.start();

            // Connect two clients
            const ws1 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
            const ws2 = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);

            await Promise.all([
                new Promise<void>((resolve) => ws1.on('open', resolve)),
                new Promise<void>((resolve) => ws2.on('open', resolve)),
            ]);

            // Wait for server to register both clients
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(server.getClientCount()).toBe(2);

            // Collect chunks from both clients
            const chunks1: unknown[] = [];
            const chunks2: unknown[] = [];
            ws1.on('message', (data) => chunks1.push(JSON.parse(data.toString())));
            ws2.on('message', (data) => chunks2.push(JSON.parse(data.toString())));

            // Stream to all
            const pcmData = generateTestPcm(100);
            const results = await server.streamToAll(pcmData);

            // Wait for messages to arrive
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(results.size).toBe(2);
            expect(chunks1.length).toBeGreaterThan(0);
            expect(chunks2.length).toBeGreaterThan(0);

            ws1.close();
            ws2.close();
        });
    });

    describe('host configuration', () => {
        it('should use custom host', async () => {
            server = new AudioStreamServer({
                port: TEST_PORT,
                host: '127.0.0.1',
            });

            await server.start();
            expect(server.isServerRunning()).toBe(true);

            // Should be able to connect via 127.0.0.1
            const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
            await new Promise<void>((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', reject);
            });

            ws.close();
        });
    });
});
