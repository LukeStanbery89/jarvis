#!/usr/bin/env node

import {
    AutoPlayClient,
    StreamStartEvent,
    StreamStats,
} from '@jarvis/audio-stream';

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

    // Create the AutoPlayClient - replaces ~150 lines of boilerplate!
    const client = new AutoPlayClient({
        url: config.url,
        autoPlay: true,
        autoReconnect: false,
    });

    // Track chunk count for verbose logging
    let chunkCount = 0;

    // Handle stream events
    client.on('stream:start', ({ streamId, format }: StreamStartEvent) => {
        console.log(`Stream ID: ${streamId}`);
        console.log(`Format: ${format.encoding} ${format.channels}ch ${format.sampleRate}Hz`);
        console.log('');
        console.log('Starting playback...');
    });

    client.on('stream:chunk', ({ sequenceNumber, isFinal }: { sequenceNumber: number; isFinal: boolean; }) => {
        chunkCount++;
        if (config.verbose) {
            console.log(`Received chunk #${sequenceNumber}${isFinal ? ' [FINAL]' : ''}`);
        } else if (sequenceNumber === 0 || isFinal || sequenceNumber % 10 === 0) {
            console.log(`Received chunk #${sequenceNumber}${isFinal ? ' [FINAL]' : ''}`);
        }
    });

    client.on('playback:end', () => {
        console.log('');
        console.log('Playback completed');
    });

    client.on('error', ({ error, context }) => {
        console.error(`Error (${context}): ${error.message}`);
    });

    client.on('disconnected', () => {
        console.log('');
        console.log('Disconnected from server');
    });

    // Connect to the server
    try {
        await client.connect();
        console.log('Connected to server');
        console.log('Waiting for audio stream...');
        console.log('');

        // Wait for playback to complete
        const stats: StreamStats = await client.waitForPlayback();

        // Print summary
        console.log('');
        console.log('=== Reception Summary ===');
        console.log(`Total chunks received: ${stats.chunkCount}`);
        console.log(`Total bytes received: ${stats.byteCount}`);
        console.log(`Audio duration: ${stats.durationMs}ms`);

        if (stats.avgLatencyMs !== undefined) {
            console.log(`Average latency: ${stats.avgLatencyMs.toFixed(1)}ms`);
        }
        if (stats.minLatencyMs !== undefined && stats.maxLatencyMs !== undefined) {
            console.log(`Latency range: ${stats.minLatencyMs}ms - ${stats.maxLatencyMs}ms`);
        }

        console.log('');
        process.exit(0);
    } catch (error) {
        console.error(`Connection error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
