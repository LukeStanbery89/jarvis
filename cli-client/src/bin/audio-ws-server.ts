#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { resolve } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import {
    AudioEncoder,
    AudioGenerator,
    DEFAULT_AUDIO_FORMAT,
    serializeChunk,
    SerializedAudioChunk,
} from '@jarvis/audio';

/**
 * Configuration for the audio WebSocket server.
 */
interface ServerConfig {
    /** Port to listen on */
    port: number;
    /** Audio source mode */
    mode: 'tone' | 'wav';
    /** Frequency in Hz (for tone mode) */
    frequency?: number;
    /** Duration in seconds (for tone mode) */
    duration?: number;
    /** Path to WAV file (for wav mode) */
    wavPath?: string;
}

/**
 * Statistics for audio streaming.
 */
interface StreamStats {
    /** Total chunks sent */
    chunksSent: number;
    /** Total bytes sent (serialized JSON) */
    bytesSent: number;
    /** Stream start time */
    startTime: number;
}

/**
 * Parses command line arguments into server configuration.
 */
function parseArgs(args: string[]): ServerConfig {
    const config: ServerConfig = {
        port: 8080,
        mode: 'tone',
        frequency: 440,
        duration: 3,
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--port' || arg === '-p') {
            const portStr = args[++i];
            const port = parseInt(portStr, 10);
            if (isNaN(port) || port <= 0 || port > 65535) {
                throw new Error(`Invalid port: ${portStr}`);
            }
            config.port = port;
        } else if (arg === '--tone' || arg === '-t') {
            config.mode = 'tone';
            const freqStr = args[++i];
            const durStr = args[++i];
            const freq = parseFloat(freqStr);
            const dur = parseFloat(durStr);
            if (isNaN(freq) || freq <= 0) {
                throw new Error(`Invalid frequency: ${freqStr}`);
            }
            if (isNaN(dur) || dur <= 0) {
                throw new Error(`Invalid duration: ${durStr}`);
            }
            config.frequency = freq;
            config.duration = dur;
        } else if (arg === '--wav' || arg === '-w') {
            config.mode = 'wav';
            config.wavPath = args[++i];
            if (!config.wavPath) {
                throw new Error('--wav requires a file path');
            }
        } else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
        i++;
    }

    return config;
}

/**
 * Prints usage information.
 */
function printUsage(): void {
    console.log('Audio WebSocket Server - Streams encoded audio chunks over WebSocket');
    console.log('');
    console.log('Usage:');
    console.log('  audio-ws-server [options]');
    console.log('');
    console.log('Options:');
    console.log('  --port, -p <port>           Port to listen on (default: 8080)');
    console.log('  --tone, -t <freq> <dur>     Generate sine wave at <freq> Hz for <dur> seconds');
    console.log('  --wav, -w <path>            Stream audio from WAV file');
    console.log('  --help, -h                  Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  audio-ws-server --tone 440 3            # 440 Hz tone for 3 seconds on port 8080');
    console.log('  audio-ws-server -p 9000 --tone 880 5    # 880 Hz tone for 5 seconds on port 9000');
    console.log('  audio-ws-server --wav ~/audio.wav       # Stream WAV file');
}

/**
 * Generates PCM data from a sine wave.
 */
async function generateSineWave(frequency: number, duration: number, sampleRate: number): Promise<Buffer> {
    const generator = new AudioGenerator(frequency, sampleRate);
    const pcmChunks: Buffer[] = [];
    const bytesPerSecond = sampleRate * 2; // 16-bit = 2 bytes per sample
    const totalBytes = bytesPerSecond * duration;
    let collectedBytes = 0;

    await new Promise<void>((resolve) => {
        generator.on('data', (chunk: Buffer) => {
            pcmChunks.push(chunk);
            collectedBytes += chunk.length;
            if (collectedBytes >= totalBytes) {
                generator.stop();
                resolve();
            }
        });
        generator.on('end', resolve);
    });

    return Buffer.concat(pcmChunks).subarray(0, totalBytes);
}

/**
 * Converts a WAV file to PCM using FFmpeg.
 */
async function wavToPcm(wavPath: string): Promise<Buffer> {
    const absolutePath = resolve(wavPath);

    if (!existsSync(absolutePath)) {
        throw new Error(`WAV file not found: ${absolutePath}`);
    }

    try {
        await fs.access(absolutePath, fs.constants.R_OK);
    } catch (err) {
        throw new Error(`Cannot read WAV file: ${(err as Error).message}`);
    }

    const format = DEFAULT_AUDIO_FORMAT;

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', absolutePath,
            '-f', format.encoding,
            '-acodec', 'pcm_s16le',
            '-ac', format.channels.toString(),
            '-ar', format.sampleRate.toString(),
            'pipe:1'
        ]);

        const chunks: Buffer[] = [];
        let stderr = '';

        ffmpeg.stdout.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    'FFmpeg not found. Please install FFmpeg.\n' +
                    'On macOS: brew install ffmpeg\n' +
                    'On Linux: sudo apt-get install ffmpeg'
                ));
            } else {
                reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
            }
        });

        ffmpeg.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                const errorMsg = stderr.split('\n').slice(-10).join('\n');
                reject(new Error(`FFmpeg exited with code ${code}:\n${errorMsg}`));
            }
        });
    });
}

/**
 * Streams audio chunks to a WebSocket client with real-time pacing.
 * Updates timestamps at send time to reflect actual transmission time.
 */
async function streamToClient(
    ws: WebSocket,
    chunks: SerializedAudioChunk[],
    clientId: string
): Promise<StreamStats> {
    const stats: StreamStats = {
        chunksSent: 0,
        bytesSent: 0,
        startTime: Date.now(),
    };

    for (const chunk of chunks) {
        if (ws.readyState !== WebSocket.OPEN) {
            console.log(`[${clientId}] Client disconnected during stream`);
            break;
        }

        // Update timestamp to current time for accurate latency measurement
        const chunkToSend = { ...chunk, timestamp: Date.now() };
        const json = JSON.stringify(chunkToSend);
        ws.send(json);
        stats.chunksSent++;
        stats.bytesSent += json.length;

        console.log(
            `[${clientId}] Sent chunk #${chunk.sequenceNumber} ` +
            `(${chunk.data.length} bytes base64, ${chunk.durationMs}ms duration` +
            `${chunk.isFinal ? ', FINAL' : ''})`
        );

        // Pace the stream to match real-time audio playback
        // Wait the full chunk duration to simulate real-time delivery
        if (!chunk.isFinal) {
            await new Promise(resolve => setTimeout(resolve, chunk.durationMs));
        }
    }

    return stats;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    let config: ServerConfig;
    try {
        config = parseArgs(args);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        console.error('');
        printUsage();
        process.exit(1);
    }

    // Generate or load PCM data
    console.log('Preparing audio source...');
    let pcmData: Buffer;

    if (config.mode === 'wav' && config.wavPath) {
        console.log(`Loading WAV file: ${config.wavPath}`);
        pcmData = await wavToPcm(config.wavPath);
    } else {
        console.log(`Generating ${config.frequency} Hz tone for ${config.duration} seconds`);
        pcmData = await generateSineWave(
            config.frequency!,
            config.duration!,
            DEFAULT_AUDIO_FORMAT.sampleRate
        );
    }

    console.log(`PCM data prepared: ${pcmData.length} bytes`);
    console.log(`Format: PCM S16LE mono ${DEFAULT_AUDIO_FORMAT.sampleRate} Hz`);

    // Encode PCM to chunks
    console.log('');
    console.log('Encoding audio to chunks...');
    const encoder = new AudioEncoder({
        chunkDurationMs: 100,
        format: DEFAULT_AUDIO_FORMAT,
    });

    const audioChunks = encoder.encode(pcmData);
    const finalChunks = encoder.flush();
    const allChunks = [...audioChunks, ...finalChunks];

    // Serialize all chunks
    const serializedChunks = allChunks.map(serializeChunk);
    const totalJsonSize = serializedChunks.reduce((sum, c) => sum + JSON.stringify(c).length, 0);

    console.log(`Encoded ${allChunks.length} chunks`);
    console.log(`Total serialized size: ${totalJsonSize} bytes`);
    console.log(`Stream ID: ${allChunks[0]?.streamId || 'N/A'}`);

    // Start WebSocket server
    console.log('');
    console.log(`Starting WebSocket server on ws://127.0.0.1:${config.port}`);

    const wss = new WebSocketServer({ port: config.port });
    let clientCounter = 0;

    wss.on('listening', () => {
        console.log(`Server listening on ws://127.0.0.1:${config.port}`);
        console.log('Waiting for clients to connect...');
        console.log('');
    });

    wss.on('connection', async (ws: WebSocket) => {
        const clientId = `client-${++clientCounter}`;
        console.log(`[${clientId}] Connected`);

        ws.on('close', () => {
            console.log(`[${clientId}] Disconnected`);
        });

        ws.on('error', (error) => {
            console.error(`[${clientId}] Error: ${error.message}`);
        });

        // Stream audio to this client
        try {
            const stats = await streamToClient(ws, serializedChunks, clientId);
            const elapsed = Date.now() - stats.startTime;
            console.log('');
            console.log(`[${clientId}] Stream complete:`);
            console.log(`  Chunks sent: ${stats.chunksSent}`);
            console.log(`  Bytes sent: ${stats.bytesSent}`);
            console.log(`  Duration: ${elapsed}ms`);
            console.log(`  Throughput: ${((stats.bytesSent / elapsed) * 1000 / 1024).toFixed(2)} KB/s`);
        } catch (error) {
            console.error(`[${clientId}] Stream error: ${(error as Error).message}`);
        }
    });

    // Handle shutdown
    const shutdown = (): void => {
        console.log('');
        console.log('Shutting down server...');
        wss.close(() => {
            console.log('Server closed');
            process.exit(0);
        });

        // Force exit after 3 seconds if graceful shutdown fails
        setTimeout(() => {
            console.log('Forcing exit...');
            process.exit(1);
        }, 3000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
