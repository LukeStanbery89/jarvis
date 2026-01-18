#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import { resolve } from 'path';
import { FFplayAudioPlayer } from '../FFplayAudioPlayer.js';
import { DEFAULT_AUDIO_FORMAT } from '../types.js';

/**
 * Streams a WAV file through FFmpeg (decode to PCM) and plays via AudioPlayer.
 * Pipeline: WAV file → FFmpeg (decode) → FFplayAudioPlayer (play)
 */

/**
 * Streams a WAV file through FFmpeg and plays it using the AudioPlayer.
 * @param wavPath - Absolute path to the WAV file
 */
async function streamWavFile(wavPath: string): Promise<void> {
    if (!existsSync(wavPath)) {
        throw new Error(`WAV file not found: ${wavPath}`);
    }

    try {
        await fs.access(wavPath, fs.constants.R_OK);
    } catch (err) {
        throw new Error(`Cannot read WAV file: ${(err as Error).message}`);
    }

    const format = DEFAULT_AUDIO_FORMAT;

    // Spawn FFmpeg to decode WAV to PCM
    const ffmpeg = spawn('ffmpeg', [
        '-i', wavPath,
        '-f', format.encoding,
        '-acodec', 'pcm_s16le',
        '-ac', format.channels.toString(),
        '-ar', format.sampleRate.toString(),
        'pipe:1'
    ]);

    const player = new FFplayAudioPlayer();

    // Handle FFmpeg errors
    ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
            throw new Error(
                'FFmpeg not found. Please install FFmpeg.\n' +
                'On macOS: brew install ffmpeg\n' +
                'On Linux: sudo apt-get install ffmpeg'
            );
        } else {
            throw new Error(`Failed to spawn FFmpeg: ${err.message}`);
        }
    });

    let ffmpegStderr = '';
    ffmpeg.stderr?.on('data', (data: Buffer) => {
        ffmpegStderr += data.toString();
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\nInterrupted by user. Stopping playback...');
        ffmpeg.kill('SIGTERM');
        player.stop();
        process.exit(130);
    });

    // Handle FFmpeg non-zero exit
    ffmpeg.on('close', (code: number | null) => {
        if (code !== 0 && code !== null) {
            const errorMsg = ffmpegStderr.split('\n').slice(-10).join('\n');
            console.error(
                `FFmpeg exited with code ${code}.\n` +
                `This might be an invalid WAV file or format issue.\n` +
                `FFmpeg error: ${errorMsg}`
            );
        }
    });

    // Play the decoded PCM stream
    if (ffmpeg.stdout) {
        await player.playStream(ffmpeg.stdout, format);
    } else {
        throw new Error('FFmpeg stdout is not available');
    }
}

/**
 * Main entry point for the CLI script.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: wav-to-pcm <wav-file>');
        console.error('Example: wav-to-pcm /path/to/audio.wav');
        console.error('');
        console.error('This script streams a WAV file through FFmpeg (decode to PCM)');
        console.error('and plays it using FFplay, simulating a real-time audio pipeline.');
        process.exit(1);
    }

    const wavPath = resolve(args[0]);

    try {
        console.log(`Streaming ${wavPath}...`);
        console.log('Pipeline: WAV file → FFmpeg (decode) → FFplay (play)');
        console.log(`Format: PCM S16LE mono ${DEFAULT_AUDIO_FORMAT.sampleRate} Hz`);
        await streamWavFile(wavPath);
        console.log('Playback completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
