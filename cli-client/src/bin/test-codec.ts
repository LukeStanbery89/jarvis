#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { resolve } from 'path';
import {
    AudioEncoder,
    AudioDecoder,
    AudioGenerator,
    FFplayAudioPlayer,
    DEFAULT_AUDIO_FORMAT,
    serializeChunk,
} from '@jarvis/audio';

/**
 * Tests the audio encode/decode pipeline:
 * 1. Generate PCM audio (sine wave or from WAV file)
 * 2. Encode to chunks with AudioEncoder
 * 3. Serialize chunks (simulating WebSocket transport)
 * 4. Deserialize and decode with AudioDecoder
 * 5. Play the reconstructed stream with FFplayAudioPlayer
 */

function printUsage(): void {
    console.error('Usage:');
    console.error('  test-codec [frequency] [duration]   - Test with generated sine wave');
    console.error('  test-codec --wav <file>             - Test with WAV file');
    console.error('');
    console.error('Examples:');
    console.error('  test-codec 440 2                    - 440 Hz sine wave for 2 seconds');
    console.error('  test-codec --wav /path/to/audio.wav - Encode/decode a WAV file');
}

/**
 * Generates PCM data from a sine wave.
 */
async function generateSineWave(frequency: number, duration: number, sampleRate: number): Promise<Buffer> {
    console.log(`Generating ${frequency} Hz sine wave for ${duration} seconds...`);

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

    console.log(`Converting ${absolutePath} to PCM...`);

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
 * Runs the encode/decode pipeline test.
 */
async function runPipeline(pcmData: Buffer): Promise<void> {
    const sampleRate = DEFAULT_AUDIO_FORMAT.sampleRate;

    console.log(`PCM data size: ${pcmData.length} bytes`);
    console.log(`Format: PCM S16LE mono ${sampleRate} Hz`);
    console.log('');

    // Set up encoder and decoder
    const encoder = new AudioEncoder({
        chunkDurationMs: 100,
        format: DEFAULT_AUDIO_FORMAT,
    });
    const decoder = new AudioDecoder();
    const player = new FFplayAudioPlayer();

    // Encode PCM to chunks
    console.log('Encoding to chunks...');
    const audioChunks = encoder.encode(pcmData);
    const finalChunks = encoder.flush();
    const allChunks = [...audioChunks, ...finalChunks];
    console.log(`Encoded into ${allChunks.length} chunks`);

    // Serialize chunks (simulating network transport)
    console.log('Serializing chunks (simulating WebSocket transport)...');
    const serializedChunks = allChunks.map(serializeChunk);
    const jsonSize = serializedChunks.reduce((sum, c) => sum + JSON.stringify(c).length, 0);
    console.log(`Serialized JSON size: ${jsonSize} bytes (${((jsonSize / pcmData.length) * 100).toFixed(1)}% of original due to base64)`);

    // Decode chunks (simulating receiving over WebSocket)
    console.log('Decoding chunks...');
    for (const chunk of serializedChunks) {
        decoder.addChunk(chunk);
    }
    console.log(`Decoder received ${allChunks.length} chunks, stream complete: ${decoder.isComplete()}`);

    // Play the decoded stream
    console.log('');
    console.log('Playing decoded audio...');

    const stream = decoder.createStream();
    const format = decoder.getFormat();

    if (!format) {
        console.error('Error: No format available from decoder');
        process.exit(1);
    }

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\nInterrupted by user. Stopping playback...');
        player.stop();
        process.exit(130);
    });

    await player.playStream(stream, format);
    console.log('');
    console.log('Playback completed successfully.');
    console.log('Encode/decode pipeline test passed!');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printUsage();
        process.exit(1);
    }

    try {
        let pcmData: Buffer;

        if (args[0] === '--wav') {
            // WAV file mode
            if (!args[1]) {
                console.error('Error: --wav requires a file path');
                printUsage();
                process.exit(1);
            }
            pcmData = await wavToPcm(args[1]);
        } else {
            // Sine wave mode
            const frequency = parseFloat(args[0]);
            const duration = args[1] ? parseFloat(args[1]) : 2;

            if (isNaN(frequency) || frequency <= 0) {
                console.error('Error: Frequency must be a positive number');
                printUsage();
                process.exit(1);
            }

            if (isNaN(duration) || duration <= 0) {
                console.error('Error: Duration must be a positive number');
                printUsage();
                process.exit(1);
            }

            pcmData = await generateSineWave(frequency, duration, DEFAULT_AUDIO_FORMAT.sampleRate);
        }

        await runPipeline(pcmData);
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
