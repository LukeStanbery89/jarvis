import { Readable } from 'stream';

/**
 * AudioGenerator is a Readable stream that generates PCM S16LE audio data.
 * It produces a continuous sine wave at the specified frequency.
 *
 * PCM Format: Signed 16-bit Little-Endian, Mono
 * - Sample range: -32768 to 32767
 * - Bytes per sample: 2
 */
export class AudioGenerator extends Readable {
    private frequency: number;
    private sampleRate: number;
    private sampleIndex: number = 0;
    private amplitude: number = 32767;
    private samplesPerChunk: number = 4096;
    private running: boolean = true;

    /**
     * Creates a new AudioGenerator.
     * @param frequency - Frequency of the sine wave in Hz (e.g., 440 for A4)
     * @param sampleRate - Audio sample rate in Hz (e.g., 16000)
     */
    constructor(frequency: number, sampleRate: number) {
        super();
        this.frequency = frequency;
        this.sampleRate = sampleRate;
    }

    /**
     * Internal method called when the stream needs more data.
     * Generates a chunk of PCM audio samples.
     */
    override _read(): void {
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
    stop(): void {
        this.running = false;
        this.push(null);
    }
}
