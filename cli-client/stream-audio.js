#!/usr/bin/env node

const { Readable } = require('stream');
const { spawn } = require('child_process');

/**
 * AudioGenerator is a Readable stream that generates PCM S16LE audio data.
 * It produces a continuous sine wave at the specified frequency.
 *
 * PCM Format: Signed 16-bit Little-Endian, Mono, 16 kHz
 * - Sample range: -32768 to 32767
 * - Bytes per sample: 2
 * - Byte rate: 32 KB/sec (16,000 samples × 2 bytes)
 */
class AudioGenerator extends Readable {
    /**
     * Creates a new AudioGenerator.
     *
     * @param {number} frequency - Frequency of the sine wave in Hz (e.g., 440 for A4)
     * @param {number} sampleRate - Audio sample rate in Hz (e.g., 16000)
     */
    constructor(frequency, sampleRate) {
        super();
        this.frequency = frequency;
        this.sampleRate = sampleRate;
        this.sampleIndex = 0;
        this.amplitude = 32767;
        this.samplesPerChunk = 4096;
        this.running = true;
    }

    /**
     * Internal method called when the stream needs more data.
     * Generates a chunk of PCM audio samples.
     */
    _read() {
        if (!this.running) {
            return;
        }

        const buffer = Buffer.alloc(this.samplesPerChunk * 2);

        for (let i = 0; i < this.samplesPerChunk; i++) {
            const sample = this.amplitude *
                Math.sin(2 * Math.PI * this.frequency * this.sampleIndex / this.sampleRate);

            buffer.writeInt16LE(Math.round(sample), i * 2);
            this.sampleIndex++;
        }

        this.push(buffer);
    }

    /**
     * Stops the audio generator and ends the stream.
     */
    stop() {
        this.running = false;
        this.push(null);
    }
}

/**
 * Main entry point for the streaming audio CLI.
 */
async function main() {
    const args = process.argv.slice(2);

    const frequency = args[0] ? parseFloat(args[0]) : 440;
    const duration = args[1] ? parseFloat(args[1]) : 5;
    const sampleRate = 16000;

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

    const audioGen = new AudioGenerator(frequency, sampleRate);

    const ffplay = spawn('ffplay', [
        '-nodisp',
        '-autoexit',
        '-hide_banner',
        '-f', 's16le',
        '-ar', sampleRate.toString(),
        '-'
    ]);

    let stderr = '';
    ffplay.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    audioGen.pipe(ffplay.stdin);

    ffplay.stdin.on('error', (err) => {
        if (err.code === 'EPIPE') {
            // FFplay closed stdin early, this is normal
        } else {
            console.error(`Stream error: ${err.message}`);
        }
    });

    const timeout = setTimeout(() => {
        audioGen.stop();
    }, duration * 1000);

    ffplay.on('error', (err) => {
        if (err.code === 'ENOENT') {
            console.error('Error: ffplay not found.');
            console.error('Please install FFmpeg with ffplay included.');
            console.error('On macOS: brew install ffmpeg');
            console.error('On Raspberry Pi OS: sudo apt-get install ffmpeg');
            clearTimeout(timeout);
            process.exit(1);
        } else {
            console.error(`Error: ${err.message}`);
            clearTimeout(timeout);
            process.exit(1);
        }
    });

    ffplay.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
            console.log('Playback completed successfully.');
            process.exit(0);
        } else {
            console.error(`ffplay exited with code ${code}`);
            if (stderr) {
                console.error('FFplay stderr:', stderr);
            }
            process.exit(code);
        }
    });

    process.on('SIGINT', () => {
        console.log('\nInterrupted by user. Stopping playback...');
        clearTimeout(timeout);
        audioGen.stop();
        ffplay.kill('SIGTERM');
    });
}

main();
