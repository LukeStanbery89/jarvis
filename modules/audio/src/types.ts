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
 * Audio chunk for network transport.
 * Represents a segment of audio data with metadata for sequencing and playback.
 */
export interface AudioChunk {
    /** Unique identifier for the audio stream this chunk belongs to */
    streamId: string;
    /** Sequence number for ordering chunks (0-indexed) */
    sequenceNumber: number;
    /** Unix timestamp (ms) when the chunk was created */
    timestamp: number;
    /** Audio format parameters for decoding */
    format: AudioFormat;
    /** Raw PCM audio data */
    data: Buffer;
    /** Duration of this chunk in milliseconds */
    durationMs: number;
    /** True if this is the final chunk in the stream */
    isFinal: boolean;
}

/**
 * Serialized audio chunk for JSON transport.
 * Identical to AudioChunk but with data encoded as base64 string.
 */
export interface SerializedAudioChunk {
    /** Unique identifier for the audio stream this chunk belongs to */
    streamId: string;
    /** Sequence number for ordering chunks (0-indexed) */
    sequenceNumber: number;
    /** Unix timestamp (ms) when the chunk was created */
    timestamp: number;
    /** Audio format parameters for decoding */
    format: AudioFormat;
    /** Base64-encoded PCM audio data */
    data: string;
    /** Duration of this chunk in milliseconds */
    durationMs: number;
    /** True if this is the final chunk in the stream */
    isFinal: boolean;
}

/**
 * Configuration options for AudioEncoder.
 */
export interface AudioEncoderConfig {
    /** Target duration for each chunk in milliseconds (default: 100) */
    chunkDurationMs?: number;
    /** Audio format for the output chunks (default: DEFAULT_AUDIO_FORMAT) */
    format?: AudioFormat;
}

/**
 * Configuration options for ChunkBuffer.
 */
export interface ChunkBufferConfig {
    /** Maximum number of chunks to buffer before dropping old ones (default: 100) */
    maxBufferSize?: number;
    /** Callback invoked when chunks are dropped due to buffer overflow */
    onChunksDropped?: (droppedSequenceNumbers: number[]) => void;
}

/**
 * Configuration options for AudioDecoder.
 */
export interface AudioDecoderConfig {
    /** Maximum number of chunks to buffer before dropping old ones (default: 100) */
    maxBufferSize?: number;
    /** Callback invoked when chunks are dropped due to buffer overflow */
    onChunksDropped?: (droppedSequenceNumbers: number[]) => void;
}
