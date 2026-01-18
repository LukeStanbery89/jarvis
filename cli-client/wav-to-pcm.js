#!/usr/bin/env node

const { spawn } = require('child_process');
const { existsSync, promises: fs } = require('fs');
const { resolve } = require('path');

/**
 * Streams a WAV file through FFmpeg (decode to PCM) and FFplay (playback).
 *
 * Pipeline: WAV file → FFmpeg (decode) → FFplay (play)
 *
 * This simulates receiving audio from a source like TTS and proves the system
 * can consume live PCM streams from external sources.
 *
 * @param {string} wavPath - Absolute path to the WAV file
 * @returns {Promise<void>}
 */
async function streamWavFile(wavPath) {
    if (!existsSync(wavPath)) {
        throw new Error(`WAV file not found: ${wavPath}`);
    }

    try {
        await fs.access(wavPath, fs.constants.R_OK);
    } catch (err) {
        throw new Error(`Cannot read WAV file: ${err.message}`);
    }

    const ffmpeg = spawn('ffmpeg', [
        '-i', wavPath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ac', '1',
        '-ar', '16000',
        'pipe:1'
    ]);

    const ffplay = spawn('ffplay', [
        '-f', 's16le',
        '-ar', '16000',
        '-nodisp',
        '-autoexit',
        '-hide_banner',
        '-'
    ]);

    return new Promise((resolve, reject) => {
        let ffmpegStderr = '';
        let ffplayStderr = '';

        ffmpeg.stderr.on('data', (data) => {
            ffmpegStderr += data.toString();
        });

        ffplay.stderr.on('data', (data) => {
            ffplayStderr += data.toString();
        });

        ffmpeg.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    'FFmpeg not found. Please install FFmpeg.\n' +
                    'On macOS: brew install ffmpeg\n' +
                    'On Raspberry Pi OS: sudo apt-get install ffmpeg'
                ));
            } else {
                reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
            }
        });

        ffplay.on('error', (err) => {
            ffmpeg.kill();
            if (err.code === 'ENOENT') {
                reject(new Error(
                    'FFplay not found. Please install FFmpeg with ffplay included.\n' +
                    'On macOS: brew install ffmpeg\n' +
                    'On Raspberry Pi OS: sudo apt-get install ffmpeg'
                ));
            } else {
                reject(new Error(`Failed to spawn FFplay: ${err.message}`));
            }
        });

        ffmpeg.stdout.pipe(ffplay.stdin);

        ffmpeg.stdout.on('error', (err) => {
            if (err.code !== 'EPIPE') {
                reject(new Error(`FFmpeg stdout pipe error: ${err.message}`));
            }
        });

        ffplay.stdin.on('error', (err) => {
            if (err.code !== 'EPIPE') {
                reject(new Error(`FFplay stdin pipe error: ${err.message}`));
            }
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0 && code !== null) {
                ffplay.stdin.end();
                const errorMsg = ffmpegStderr.split('\n').slice(-10).join('\n');
                reject(new Error(
                    `FFmpeg exited with code ${code}.\n` +
                    `This might be an invalid WAV file or format issue.\n` +
                    `FFmpeg error: ${errorMsg}`
                ));
            }
        });

        ffplay.on('close', (code) => {
            if (code === 0 || code === null) {
                resolve();
            } else {
                reject(new Error(
                    `FFplay exited with code ${code}.\n` +
                    `FFplay error: ${ffplayStderr}`
                ));
            }
        });

        process.on('SIGINT', () => {
            console.log('\nInterrupted by user. Stopping playback...');
            ffmpeg.kill('SIGTERM');
            ffplay.kill('SIGTERM');
            process.exit(130);
        });
    });
}

/**
 * Main entry point for the CLI script.
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: wav-to-pcm <wav-file>');
        console.error('Example: wav-to-pcm /path/to/audio.wav');
        console.error('');
        console.error('This script streams a WAV file through FFmpeg (decode to PCM)');
        console.error('and FFplay (playback), simulating a real-time audio pipeline.');
        process.exit(1);
    }

    const wavPath = resolve(args[0]);

    try {
        console.log(`Streaming ${wavPath}...`);
        console.log('Pipeline: WAV file → FFmpeg (decode) → FFplay (play)');
        console.log('Format: PCM S16LE mono 16 kHz');
        await streamWavFile(wavPath);
        console.log('Playback completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();
