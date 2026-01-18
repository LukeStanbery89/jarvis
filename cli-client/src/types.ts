import { Readable } from 'stream';

/**
 * Audio format specification for PCM streams.
 * Defines the encoding parameters needed to interpret raw audio data.
 */
export interface AudioFormat {
    /** Sample rate in Hz (e.g., 16000 for 16 kHz) */
    sampleRate: number;
    /** Number of audio channels (1 = mono, 2 = stereo) */
    channels: number;
    /** Bit depth per sample (e.g., 16 for 16-bit) */
    bitDepth: number;
    /** Encoding format identifier (e.g., 's16le' for signed 16-bit little-endian) */
    encoding: 's16le' | 's16be' | 'f32le' | 'f32be';
}

/**
 * Core audio player interface.
 * Implementations handle the actual playback mechanism (ffplay, native, etc.)
 */
export interface AudioPlayer {
    /**
     * Plays audio from a Readable stream.
     * Resolves when playback completes, rejects on error.
     */
    playStream(stream: Readable, format: AudioFormat): Promise<void>;

    /**
     * Stops any currently playing audio.
     * Safe to call even if nothing is playing.
     */
    stop(): void;
}

/**
 * Default audio format: PCM S16LE mono 16 kHz.
 * This is a common format for voice/speech audio.
 */
export const DEFAULT_AUDIO_FORMAT: AudioFormat = {
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    encoding: 's16le',
};
