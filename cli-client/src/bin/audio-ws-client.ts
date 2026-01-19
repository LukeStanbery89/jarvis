#!/usr/bin/env node

import WebSocket from 'ws';
import {
    AudioDecoder,
    FFplayAudioPlayer,
    SerializedAudioChunk,
} from '@jarvis/audio';

/**
 * Configuration for the audio WebSocket client.
 */
interface ClientConfig {
    /** WebSocket server URL */
    url: string;
    /** Whether to enable verbose logging */
    verbose: boolean;
}

/**
 * Statistics for audio reception.
 */
interface ReceptionStats {
    /** Total chunks received */
    chunksReceived: number;
    /** Total bytes received (raw JSON) */
    bytesReceived: number;
    /** Sequence numbers received (for gap detection) */
    sequenceNumbers: number[];
    /** First chunk timestamp */
    firstChunkTime: number | null;
    /** Last chunk timestamp */
    lastChunkTime: number | null;
    /** Network latencies (chunk timestamp to receive time) */
    latencies: number[];
}

/**
 * Parses command line arguments into client configuration.
 */
function parseArgs(args: string[]): ClientConfig {
    const config: ClientConfig = {
        url: 'ws://127.0.0.1:8080',
        verbose: false,
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--url' || arg === '-u') {
            config.url = args[++i];
            if (!config.url) {
                throw new Error('--url requires a WebSocket URL');
            }
        } else if (arg === '--verbose' || arg === '-v') {
            config.verbose = true;
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
    console.log('Audio WebSocket Client - Receives and plays audio chunks over WebSocket');
    console.log('');
    console.log('Usage:');
    console.log('  audio-ws-client [options]');
    console.log('');
    console.log('Options:');
    console.log('  --url, -u <url>     WebSocket server URL (default: ws://127.0.0.1:8080)');
    console.log('  --verbose, -v       Enable verbose logging');
    console.log('  --help, -h          Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  audio-ws-client                              # Connect to default server');
    console.log('  audio-ws-client --url ws://127.0.0.1:9000    # Connect to custom port');
    console.log('  audio-ws-client -v                           # Verbose output');
}

/**
 * Calculates statistics summary.
 */
function calculateStatsSummary(stats: ReceptionStats): {
    totalChunks: number;
    totalBytes: number;
    duration: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    gaps: number[];
} {
    const duration = stats.lastChunkTime && stats.firstChunkTime
        ? stats.lastChunkTime - stats.firstChunkTime
        : 0;

    // Find gaps in sequence numbers
    const sortedSeq = [...stats.sequenceNumbers].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sortedSeq.length; i++) {
        if (sortedSeq[i] - sortedSeq[i - 1] > 1) {
            for (let j = sortedSeq[i - 1] + 1; j < sortedSeq[i]; j++) {
                gaps.push(j);
            }
        }
    }

    const avgLatency = stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0;
    const minLatency = stats.latencies.length > 0
        ? Math.min(...stats.latencies)
        : 0;
    const maxLatency = stats.latencies.length > 0
        ? Math.max(...stats.latencies)
        : 0;

    return {
        totalChunks: stats.chunksReceived,
        totalBytes: stats.bytesReceived,
        duration,
        avgLatency,
        minLatency,
        maxLatency,
        gaps,
    };
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    let config: ClientConfig;
    try {
        config = parseArgs(args);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        console.error('');
        printUsage();
        process.exit(1);
    }

    console.log(`Connecting to ${config.url}...`);

    const decoder = new AudioDecoder();
    const player = new FFplayAudioPlayer();
    const stats: ReceptionStats = {
        chunksReceived: 0,
        bytesReceived: 0,
        sequenceNumbers: [],
        firstChunkTime: null,
        lastChunkTime: null,
        latencies: [],
    };

    let streamId: string | null = null;
    let playbackStarted = false;
    let playbackPromise: Promise<void> | null = null;

    const ws = new WebSocket(config.url);

    ws.on('open', () => {
        console.log('Connected to server');
        console.log('Waiting for audio stream...');
        console.log('');
    });

    ws.on('message', (data: WebSocket.RawData) => {
        const now = Date.now();
        const jsonStr = data.toString();
        stats.bytesReceived += jsonStr.length;

        let chunk: SerializedAudioChunk;
        try {
            chunk = JSON.parse(jsonStr) as SerializedAudioChunk;
        } catch (error) {
            console.error(`Failed to parse chunk: ${(error as Error).message}`);
            return;
        }

        // Track statistics
        stats.chunksReceived++;
        stats.sequenceNumbers.push(chunk.sequenceNumber);
        if (stats.firstChunkTime === null) {
            stats.firstChunkTime = now;
        }
        stats.lastChunkTime = now;

        // Calculate latency (time from chunk creation to receipt)
        const latency = now - chunk.timestamp;
        stats.latencies.push(latency);

        // Log reception
        if (config.verbose) {
            console.log(
                `Received chunk #${chunk.sequenceNumber}: ` +
                `${chunk.data.length} bytes base64, ` +
                `${chunk.durationMs}ms duration, ` +
                `latency ${latency}ms` +
                `${chunk.isFinal ? ' [FINAL]' : ''}`
            );
        } else if (chunk.sequenceNumber === 0 || chunk.isFinal || chunk.sequenceNumber % 10 === 0) {
            // Log periodically in non-verbose mode
            console.log(
                `Received chunk #${chunk.sequenceNumber}` +
                `${chunk.isFinal ? ' [FINAL]' : ''}`
            );
        }

        // Capture stream ID from first chunk
        if (streamId === null) {
            streamId = chunk.streamId;
            console.log(`Stream ID: ${streamId}`);
            console.log(`Format: ${chunk.format.encoding} ${chunk.format.channels}ch ${chunk.format.sampleRate}Hz`);
            console.log('');
        }

        // Add chunk to decoder
        decoder.addChunk(chunk);

        // Start playback after receiving first chunk
        if (!playbackStarted) {
            playbackStarted = true;
            console.log('Starting playback...');

            const stream = decoder.createStream();
            const format = decoder.getFormat();

            if (format) {
                playbackPromise = player.playStream(stream, format)
                    .then(() => {
                        console.log('');
                        console.log('Playback completed');
                    })
                    .catch((error) => {
                        console.error(`Playback error: ${error.message}`);
                    });
            }
        }
    });

    ws.on('close', async () => {
        console.log('');
        console.log('Disconnected from server');

        // Wait for playback to complete
        if (playbackPromise) {
            console.log('Waiting for playback to finish...');
            await playbackPromise;
        }

        // Print summary
        const summary = calculateStatsSummary(stats);

        console.log('');
        console.log('=== Reception Summary ===');
        console.log(`Total chunks received: ${summary.totalChunks}`);
        console.log(`Total bytes received: ${summary.totalBytes}`);
        console.log(`Reception duration: ${summary.duration}ms`);
        console.log(`Average latency: ${summary.avgLatency.toFixed(1)}ms`);
        console.log(`Latency range: ${summary.minLatency}ms - ${summary.maxLatency}ms`);

        if (summary.gaps.length > 0) {
            console.log(`Missing chunks: ${summary.gaps.join(', ')}`);
        } else {
            console.log('All chunks received in sequence');
        }

        console.log('');
        process.exit(0);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error: ${error.message}`);
        process.exit(1);
    });

    // Handle shutdown
    const shutdown = (): void => {
        console.log('');
        console.log('Shutting down...');
        player.stop();
        ws.close();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
