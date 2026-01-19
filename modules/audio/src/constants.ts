import { AudioFormat } from './types.js';

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

/**
 * Default chunk duration for encoding in milliseconds.
 * 100ms provides a good balance between latency and overhead.
 */
export const DEFAULT_CHUNK_DURATION_MS = 100;

/**
 * Default maximum buffer size for decoder (number of chunks).
 */
export const DEFAULT_MAX_BUFFER_SIZE = 100;

/**
 * Calculates the number of bytes per audio sample based on format.
 * @param format - The audio format specification
 * @returns Number of bytes per sample (channels * bytesPerChannel)
 */
export function getBytesPerSample(format: AudioFormat): number {
    const bytesPerChannel = format.bitDepth / 8;
    return format.channels * bytesPerChannel;
}

/**
 * Calculates the byte size for a given duration of audio.
 * @param format - The audio format specification
 * @param durationMs - Duration in milliseconds
 * @returns Number of bytes
 */
export function getBytesForDuration(format: AudioFormat, durationMs: number): number {
    const samplesPerMs = format.sampleRate / 1000;
    const bytesPerSample = getBytesPerSample(format);
    return Math.floor(samplesPerMs * durationMs * bytesPerSample);
}

/**
 * Calculates the duration in milliseconds for a given buffer size.
 * @param format - The audio format specification
 * @param bytes - Number of bytes
 * @returns Duration in milliseconds
 */
export function getDurationForBytes(format: AudioFormat, bytes: number): number {
    const bytesPerSample = getBytesPerSample(format);
    const samples = bytes / bytesPerSample;
    return (samples / format.sampleRate) * 1000;
}
