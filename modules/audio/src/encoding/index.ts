import { AudioChunk, SerializedAudioChunk } from '../types.js';

export { AudioEncoder } from './AudioEncoder.js';

/**
 * Serializes an AudioChunk for JSON transport.
 * Converts the Buffer data to a base64 string.
 * @param chunk - The audio chunk to serialize
 * @returns Serialized chunk with base64-encoded data
 */
export function serializeChunk(chunk: AudioChunk): SerializedAudioChunk {
    return {
        streamId: chunk.streamId,
        sequenceNumber: chunk.sequenceNumber,
        timestamp: chunk.timestamp,
        format: { ...chunk.format },
        data: chunk.data.toString('base64'),
        durationMs: chunk.durationMs,
        isFinal: chunk.isFinal,
    };
}

/**
 * Deserializes a SerializedAudioChunk back to an AudioChunk.
 * Converts the base64 data string back to a Buffer.
 * @param chunk - The serialized chunk to deserialize
 * @returns Audio chunk with Buffer data
 */
export function deserializeChunk(chunk: SerializedAudioChunk): AudioChunk {
    return {
        streamId: chunk.streamId,
        sequenceNumber: chunk.sequenceNumber,
        timestamp: chunk.timestamp,
        format: { ...chunk.format },
        data: Buffer.from(chunk.data, 'base64'),
        durationMs: chunk.durationMs,
        isFinal: chunk.isFinal,
    };
}

/**
 * Type guard to check if a chunk is serialized (has string data).
 * @param chunk - The chunk to check
 * @returns True if the chunk has string data (serialized)
 */
export function isSerializedChunk(chunk: AudioChunk | SerializedAudioChunk): chunk is SerializedAudioChunk {
    return typeof chunk.data === 'string';
}
