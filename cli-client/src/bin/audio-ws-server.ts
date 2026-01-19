#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { resolve } from 'path';
import {
    AudioGenerator,
    DEFAULT_AUDIO_FORMAT,
} from '@jarvis/audio';
import {
    AudioStreamServer,
    ClientConnectEvent,
    ClientDisconnectEvent,
    StreamEndEvent,
} from '@jarvis/audio-stream';

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
    console.log('');

    // Create the AudioStreamServer - replaces ~50 lines of boilerplate!
    const server = new AudioStreamServer({
        port: config.port,
        senderConfig: {
            chunkDurationMs: 100,
            format: DEFAULT_AUDIO_FORMAT,
            realTimePacing: true,
        },
    });

    // Handle client connections
    server.on('client:connect', ({ clientId }: ClientConnectEvent) => {
        console.log(`[${clientId}] Connected`);

        // Stream audio to the newly connected client
        server.streamToClient(clientId, pcmData)
            .then((stats) => {
                console.log('');
                console.log(`[${clientId}] Stream complete:`);
                console.log(`  Chunks sent: ${stats.chunkCount}`);
                console.log(`  Bytes sent: ${stats.byteCount}`);
                console.log(`  Duration: ${stats.durationMs}ms`);
            })
            .catch((error) => {
                console.error(`[${clientId}] Stream error: ${error.message}`);
            });
    });

    server.on('client:disconnect', ({ clientId }: ClientDisconnectEvent) => {
        console.log(`[${clientId}] Disconnected`);
    });

    server.on('stream:end', ({ clientId, stats }: StreamEndEvent & { clientId: string }) => {
        if (stats.endTime && stats.startTime) {
            const elapsed = stats.endTime - stats.startTime;
            console.log(`[${clientId}] Throughput: ${((stats.byteCount / elapsed) * 1000 / 1024).toFixed(2)} KB/s`);
        }
    });

    // Start the server
    console.log(`Starting WebSocket server on ws://127.0.0.1:${config.port}`);
    await server.start();
    console.log('Waiting for clients to connect...');
    console.log('');

    // Handle shutdown
    const shutdown = async (): Promise<void> => {
        console.log('');
        console.log('Shutting down server...');
        await server.stop();
        console.log('Server closed');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
