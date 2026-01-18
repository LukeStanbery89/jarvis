#!/usr/bin/env node

import { createReadStream, existsSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

/**
 * Plays an audio file using ffplay.
 * This script handles file playback directly, letting ffplay detect the format.
 */

/**
 * Plays an audio file using ffplay.
 * @param filePath - Path to the audio file to play
 */
function playAudio(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = ['-nodisp', '-autoexit', '-hide_banner', filePath];

        console.log(`Playing ${filePath} using ffplay...`);

        const player = spawn('ffplay', args);

        let stderr = '';
        player.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        player.on('close', (code: number | null) => {
            if (code === 0) {
                console.log('Playback completed successfully.');
                resolve();
            } else {
                reject(new Error(`Player exited with code ${code}${stderr ? ':\n' + stderr : ''}`));
            }
        });

        player.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    "Audio player 'ffplay' not found. " +
                    'Please install FFmpeg with ffplay included. ' +
                    'On macOS: brew install ffmpeg'
                ));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Main entry point for the CLI script.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: play-audio <audio-file>');
        console.error('Example: play-audio /path/to/audio.wav');
        process.exit(1);
    }

    const filePath = resolve(args[0]);

    if (!existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }

    try {
        await playAudio(filePath);
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
