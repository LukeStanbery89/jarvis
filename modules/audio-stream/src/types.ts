import { AudioFormat, SerializedAudioChunk } from '@jarvis/audio';

/**
 * Callback function for emitting serialized audio chunks.
 * This is the transport-agnostic mechanism for sending chunks.
 * Implementations can use WebSocket, HTTP, IPC, or any other transport.
 *
 * @param chunk - The serialized audio chunk to emit
 * @returns void or Promise<void> for async transports
 */
export type ChunkEmitter = (chunk: SerializedAudioChunk) => void | Promise<void>;

/**
 * Configuration options for AudioStreamSender.
 * Controls how PCM audio is encoded and transmitted.
 */
export interface AudioStreamSenderConfig {
    /**
     * Target duration for each audio chunk in milliseconds.
     * Smaller values reduce latency but increase overhead.
     * Larger values are more efficient but increase latency.
     * @default 100
     */
    chunkDurationMs?: number;

    /**
     * Audio format specification for encoding.
     * Defines sample rate, channels, bit depth, and encoding type.
     * @default DEFAULT_AUDIO_FORMAT (PCM S16LE mono 16kHz)
     */
    format?: AudioFormat;

    /**
     * Whether to pace chunk emission to match real-time audio playback.
     * When true, chunks are emitted with delays matching their duration.
     * When false, all chunks are emitted as fast as possible.
     * @default true
     */
    realTimePacing?: boolean;
}

/**
 * Configuration options for AudioStreamReceiver.
 * Controls buffering and overflow behavior.
 */
export interface AudioStreamReceiverConfig {
    /**
     * Maximum number of chunks to buffer before dropping old ones.
     * Higher values handle more network jitter but use more memory.
     * @default 100
     */
    maxBufferSize?: number;

    /**
     * Callback invoked when chunks are dropped due to buffer overflow.
     * Useful for monitoring and debugging streaming issues.
     * @param droppedSequenceNumbers - Sequence numbers of dropped chunks
     */
    onChunksDropped?: (droppedSequenceNumbers: number[]) => void;
}

/**
 * Statistics for a completed or in-progress audio stream.
 * Used for monitoring and debugging streaming performance.
 */
export interface StreamStats {
    /** Total number of chunks processed */
    chunkCount: number;

    /** Total bytes of audio data (PCM, not serialized) */
    byteCount: number;

    /** Total duration of audio in milliseconds */
    durationMs: number;

    /**
     * Average network latency in milliseconds.
     * Only available for receivers (calculated from chunk timestamps).
     */
    avgLatencyMs?: number;

    /**
     * Minimum network latency observed in milliseconds.
     * Only available for receivers.
     */
    minLatencyMs?: number;

    /**
     * Maximum network latency observed in milliseconds.
     * Only available for receivers.
     */
    maxLatencyMs?: number;

    /** Stream start timestamp (Unix ms) */
    startTime?: number;

    /** Stream end timestamp (Unix ms) */
    endTime?: number;
}

/**
 * Configuration options for AudioStreamServer.
 * Defines server setup and sender behavior.
 */
export interface AudioStreamServerConfig {
    /**
     * Port number for the WebSocket server to listen on.
     */
    port: number;

    /**
     * Host address to bind to.
     * @default '127.0.0.1'
     */
    host?: string;

    /**
     * Configuration for the internal AudioStreamSender.
     * Controls chunk duration, format, and pacing.
     */
    senderConfig?: AudioStreamSenderConfig;
}

/**
 * Configuration options for AudioStreamClient.
 * Defines connection behavior and receiver settings.
 */
export interface AudioStreamClientConfig {
    /**
     * WebSocket server URL to connect to.
     * Must be a valid WebSocket URL (ws:// or wss://).
     */
    url: string;

    /**
     * Whether to automatically reconnect on disconnect.
     * When true, the client will attempt to reconnect with exponential backoff.
     * @default true
     */
    autoReconnect?: boolean;

    /**
     * Maximum number of reconnection attempts before giving up.
     * Only used when autoReconnect is true.
     * @default 5
     */
    maxReconnectAttempts?: number;

    /**
     * Initial delay between reconnection attempts in milliseconds.
     * The delay increases exponentially with each attempt.
     * @default 1000
     */
    reconnectDelayMs?: number;

    /**
     * Configuration for the internal AudioStreamReceiver.
     * Controls buffering behavior.
     */
    receiverConfig?: AudioStreamReceiverConfig;
}

/**
 * Configuration options for AutoPlayClient.
 * Extends AudioStreamClient with automatic playback features.
 */
export interface AutoPlayClientConfig extends AudioStreamClientConfig {
    /**
     * Whether to automatically start playback when audio is received.
     * When true, playback begins as soon as the first chunk arrives.
     * @default true
     */
    autoPlay?: boolean;
}

/**
 * Event payload for client connection events.
 */
export interface ClientConnectEvent {
    /** Unique identifier for the connected client */
    clientId: string;
}

/**
 * Event payload for client disconnection events.
 */
export interface ClientDisconnectEvent {
    /** Unique identifier for the disconnected client */
    clientId: string;

    /** Disconnect code (if available) */
    code?: number;

    /** Disconnect reason (if available) */
    reason?: string;
}

/**
 * Event payload for stream start events.
 */
export interface StreamStartEvent {
    /** Unique identifier for the audio stream */
    streamId: string;

    /** Audio format for this stream */
    format: AudioFormat;
}

/**
 * Event payload for stream end events.
 */
export interface StreamEndEvent {
    /** Unique identifier for the completed audio stream */
    streamId: string;

    /** Statistics for the completed stream */
    stats: StreamStats;
}

/**
 * Event payload for chunk events.
 */
export interface ChunkEvent {
    /** Sequence number of the chunk */
    sequenceNumber: number;

    /** Duration of this chunk in milliseconds */
    durationMs: number;

    /** Whether this is the final chunk in the stream */
    isFinal: boolean;
}

/**
 * Event payload for error events.
 */
export interface StreamErrorEvent {
    /** Error that occurred */
    error: Error;

    /** Context where the error occurred */
    context?: string;
}
