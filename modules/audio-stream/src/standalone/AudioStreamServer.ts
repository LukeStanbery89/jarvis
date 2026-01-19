import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';

import {
    AudioStreamServerConfig,
    StreamStats,
    ClientConnectEvent,
    ClientDisconnectEvent,
    StreamStartEvent,
    StreamEndEvent,
    StreamErrorEvent,
} from '../types.js';
import { AudioStreamSender } from '../core/AudioStreamSender.js';

/**
 * Information about a connected client.
 */
interface ClientInfo {
    /** The WebSocket connection */
    ws: WebSocket;

    /** Client identifier */
    clientId: string;

    /** Connection timestamp */
    connectedAt: number;
}

/**
 * WebSocket server wrapper around AudioStreamSender.
 * Provides a high-level API for streaming audio to connected WebSocket clients.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const server = new AudioStreamServer({ port: 8080 });
 *
 * server.on('client:connect', ({ clientId }) => {
 *     console.log(`Client connected: ${clientId}`);
 *     server.streamToClient(clientId, pcmData).then(stats => {
 *         console.log(`Streamed ${stats.chunkCount} chunks`);
 *     });
 * });
 *
 * await server.start();
 *
 * // Later: stream to all clients
 * const results = await server.streamToAll(newPcmData);
 *
 * // Cleanup
 * await server.stop();
 * ```
 *
 * @fires AudioStreamServer#client:connect - When a client connects
 * @fires AudioStreamServer#client:disconnect - When a client disconnects
 * @fires AudioStreamServer#stream:start - When streaming begins to a client
 * @fires AudioStreamServer#stream:end - When streaming completes for a client
 * @fires AudioStreamServer#error - When an error occurs
 */
export class AudioStreamServer extends EventEmitter {
    private config: AudioStreamServerConfig;
    private wss: WebSocketServer | null = null;
    private clients: Map<string, ClientInfo> = new Map();
    private clientCounter: number = 0;
    private isRunning: boolean = false;

    /**
     * Creates a new AudioStreamServer.
     *
     * @param config - Server configuration including port and sender options
     */
    constructor(config: AudioStreamServerConfig) {
        super();
        this.config = config;
    }

    /**
     * Starts the WebSocket server.
     * Begins listening for client connections.
     *
     * @returns Promise that resolves when the server is listening
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        return new Promise((resolve, reject) => {
            const host = this.config.host ?? '127.0.0.1';

            this.wss = new WebSocketServer({
                port: this.config.port,
                host,
            });

            this.wss.on('listening', () => {
                this.isRunning = true;
                resolve();
            });

            this.wss.on('error', (error) => {
                if (!this.isRunning) {
                    reject(error);
                } else {
                    const errorEvent: StreamErrorEvent = {
                        error,
                        context: 'WebSocket server error',
                    };
                    this.emit('error', errorEvent);
                }
            });

            this.wss.on('connection', (ws: WebSocket) => {
                this.handleConnection(ws);
            });
        });
    }

    /**
     * Stops the WebSocket server.
     * Closes all client connections and stops listening.
     *
     * @returns Promise that resolves when the server has stopped
     */
    async stop(): Promise<void> {
        if (!this.isRunning || !this.wss) {
            return;
        }

        return new Promise((resolve) => {
            // Close all client connections
            for (const [, clientInfo] of this.clients) {
                clientInfo.ws.close();
            }
            this.clients.clear();

            this.wss!.close(() => {
                this.isRunning = false;
                this.wss = null;
                resolve();
            });
        });
    }

    /**
     * Streams PCM audio data to a specific client.
     *
     * @param clientId - The ID of the client to stream to
     * @param pcmData - Raw PCM audio data to stream
     * @returns Promise resolving to stream statistics
     * @throws Error if client is not connected
     */
    async streamToClient(clientId: string, pcmData: Buffer): Promise<StreamStats> {
        const clientInfo = this.clients.get(clientId);
        if (!clientInfo) {
            throw new Error(`Client not connected: ${clientId}`);
        }

        const sender = new AudioStreamSender(this.config.senderConfig);

        // Forward sender events
        sender.on('stream:start', (event: StreamStartEvent) => {
            this.emit('stream:start', { ...event, clientId });
        });

        sender.on('stream:end', (event: StreamEndEvent) => {
            this.emit('stream:end', { ...event, clientId });
        });

        sender.on('error', (event: StreamErrorEvent) => {
            this.emit('error', { ...event, clientId });
        });

        return sender.send(pcmData, (chunk) => {
            if (clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(JSON.stringify(chunk));
            }
        });
    }

    /**
     * Streams PCM audio data to all connected clients.
     *
     * @param pcmData - Raw PCM audio data to stream
     * @returns Promise resolving to a map of client IDs to their stream statistics
     */
    async streamToAll(pcmData: Buffer): Promise<Map<string, StreamStats>> {
        const results = new Map<string, StreamStats>();
        const promises: Promise<void>[] = [];

        for (const clientId of this.clients.keys()) {
            const promise = this.streamToClient(clientId, pcmData)
                .then(stats => {
                    results.set(clientId, stats);
                })
                .catch(error => {
                    const errorEvent: StreamErrorEvent = {
                        error,
                        context: `Failed to stream to client ${clientId}`,
                    };
                    this.emit('error', errorEvent);
                });
            promises.push(promise);
        }

        await Promise.all(promises);
        return results;
    }

    /**
     * Streams from a Readable source to a specific client.
     *
     * @param clientId - The ID of the client to stream to
     * @param source - Readable stream of PCM audio data
     * @returns Promise resolving to stream statistics
     * @throws Error if client is not connected
     */
    async streamReadableToClient(clientId: string, source: Readable): Promise<StreamStats> {
        const clientInfo = this.clients.get(clientId);
        if (!clientInfo) {
            throw new Error(`Client not connected: ${clientId}`);
        }

        const sender = new AudioStreamSender(this.config.senderConfig);

        // Forward sender events
        sender.on('stream:start', (event: StreamStartEvent) => {
            this.emit('stream:start', { ...event, clientId });
        });

        sender.on('stream:end', (event: StreamEndEvent) => {
            this.emit('stream:end', { ...event, clientId });
        });

        sender.on('error', (event: StreamErrorEvent) => {
            this.emit('error', { ...event, clientId });
        });

        return sender.sendFromStream(source, (chunk) => {
            if (clientInfo.ws.readyState === WebSocket.OPEN) {
                clientInfo.ws.send(JSON.stringify(chunk));
            }
        });
    }

    /**
     * Gets the IDs of all connected clients.
     *
     * @returns Array of client IDs
     */
    getConnectedClients(): string[] {
        return Array.from(this.clients.keys());
    }

    /**
     * Checks if a specific client is connected.
     *
     * @param clientId - The client ID to check
     * @returns true if the client is connected
     */
    isClientConnected(clientId: string): boolean {
        return this.clients.has(clientId);
    }

    /**
     * Gets the number of connected clients.
     *
     * @returns Number of connected clients
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Checks if the server is currently running.
     *
     * @returns true if the server is running
     */
    isServerRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Gets the port the server is configured to use.
     *
     * @returns The port number
     */
    getPort(): number {
        return this.config.port;
    }

    /**
     * Handles a new WebSocket connection.
     */
    private handleConnection(ws: WebSocket): void {
        const clientId = `client-${++this.clientCounter}`;
        const clientInfo: ClientInfo = {
            ws,
            clientId,
            connectedAt: Date.now(),
        };

        this.clients.set(clientId, clientInfo);

        // Emit connect event
        const connectEvent: ClientConnectEvent = { clientId };
        this.emit('client:connect', connectEvent);

        // Handle disconnect
        ws.on('close', (code, reason) => {
            this.clients.delete(clientId);

            const disconnectEvent: ClientDisconnectEvent = {
                clientId,
                code,
                reason: reason?.toString(),
            };
            this.emit('client:disconnect', disconnectEvent);
        });

        // Handle errors
        ws.on('error', (error) => {
            const errorEvent: StreamErrorEvent = {
                error,
                context: `Client ${clientId} WebSocket error`,
            };
            this.emit('error', errorEvent);
        });
    }
}
