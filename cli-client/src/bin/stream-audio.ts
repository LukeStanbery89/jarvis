#!/usr/bin/env node

import { FFplayAudioPlayer } from '../FFplayAudioPlayer.js';
import { AudioGenerator } from '../AudioGenerator.js';
import { DEFAULT_AUDIO_FORMAT } from '../types.js';

/**
 * Generates and plays a synthetic sine wave using the AudioPlayer abstraction.
 */

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const frequency = args[0] ? parseFloat(args[0]) : 440;
    const duration = args[1] ? parseFloat(args[1]) : 5;
    const sampleRate = DEFAULT_AUDIO_FORMAT.sampleRate;

    if (isNaN(frequency) || frequency <= 0) {
        console.error('Error: Frequency must be a positive number');
        console.error('Usage: stream-audio [frequency] [duration]');
        console.error('Example: stream-audio 440 5');
        process.exit(1);
    }

    if (isNaN(duration) || duration <= 0) {
        console.error('Error: Duration must be a positive number');
        console.error('Usage: stream-audio [frequency] [duration]');
        console.error('Example: stream-audio 440 5');
        process.exit(1);
    }

    console.log(`Streaming ${frequency} Hz sine wave for ${duration} seconds...`);
    console.log(`Format: PCM S16LE mono ${sampleRate} Hz`);

    const player = new FFplayAudioPlayer();
    const generator = new AudioGenerator(frequency, sampleRate);

    // Set up duration timeout
    const timeout = setTimeout(() => {
        generator.stop();
    }, duration * 1000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\nInterrupted by user. Stopping playback...');
        clearTimeout(timeout);
        generator.stop();
        player.stop();
    });

    try {
        await player.playStream(generator, DEFAULT_AUDIO_FORMAT);
        clearTimeout(timeout);
        console.log('Playback completed successfully.');
        process.exit(0);
    } catch (error) {
        clearTimeout(timeout);
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
}

main();
