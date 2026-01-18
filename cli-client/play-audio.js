#!/usr/bin/env node

const { spawn } = require('child_process');
const { platform } = require('os');
const { existsSync } = require('fs');
const { resolve } = require('path');

/**
 * Plays an audio file using native system commands.
 *
 * Supported platforms:
 * - macOS: Uses afplay
 * - Linux (Raspberry Pi OS): Uses aplay
 *
 * @param {string} filePath - Path to the audio file to play
 * @returns {Promise<void>}
 */
function playAudio(filePath) {
    return new Promise((resolve, reject) => {
        const currentPlatform = platform();
        let command, args;

        // Determine the audio player command based on platform
        if (currentPlatform === 'darwin') {
            command = 'afplay';
            args = [filePath];
        } else if (currentPlatform === 'linux') {
            command = 'aplay';
            args = [filePath];
        } else {
            reject(new Error(`Unsupported platform: ${currentPlatform}. This script supports macOS (darwin) and Linux only.`));
            return;
        }

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
                    (currentPlatform === 'linux'
                        ? 'Please install it with: sudo apt-get install alsa-utils'
                        : 'This should be built into macOS.')
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
