#!/usr/bin/env node

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');

/**
 * Plays an audio file using ffplay.
 *
 * ffplay is part of the FFmpeg suite and provides cross-platform audio playback.
 * It supports a wide variety of audio formats and codecs.
 *
 * @param {string} filePath - Path to the audio file to play
 * @returns {Promise<void>}
 */
function playAudio(filePath) {
    return new Promise((resolve, reject) => {
        const command = 'ffplay';
        // ffplay arguments:
        // -nodisp: no video display (audio only)
        // -autoexit: exit when playback finishes
        // -hide_banner: suppress FFmpeg banner
        const args = ['-nodisp', '-autoexit', '-hide_banner', filePath];

        console.log(`Playing ${filePath} using ${command}...`);

        // Spawn the audio player process
        const player = spawn(command, args);

        // Capture stderr for error messages
        let stderr = '';
        player.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // Handle process completion
        player.on('close', (code) => {
            if (code === 0) {
                console.log('Playback completed successfully.');
                resolve();
            } else {
                reject(new Error(`Player exited with code ${code}${stderr ? ':\n' + stderr : ''}`));
            }
        });

        // Handle process errors (e.g., command not found)
        player.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    `Audio player '${command}' not found. ` +
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
async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: play-audio <audio-file>');
        console.error('Example: play-audio /path/to/audio.wav');
        process.exit(1);
    }

    const filePath = resolve(args[0]);

    // Validate that the file exists
    if (!existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }

    // Play the audio file
    try {
        await playAudio(filePath);
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
main();
