import { Readable } from 'stream';
import { AudioFormat, FFplayAudioPlayer } from '@jarvis/audio';

import {
    AutoPlayClientConfig,
    StreamStats,
    StreamErrorEvent,
} from '../types.js';
import { AudioStreamClient } from './AudioStreamClient.js';

/**
 * AudioStreamClient with automatic FFplay playback.
 * Extends AudioStreamClient to automatically play audio as it's received.
 *
 * @example
 * ```typescript
 * // Simplest usage - connect and play
 * const client = new AutoPlayClient({ url: 'ws://127.0.0.1:8080' });
 * await client.connect();
 * const stats = await client.waitForPlayback();
 * console.log(`Played ${stats.chunkCount} chunks`);
 *
 * // With auto-play disabled
 * const client = new AutoPlayClient({
 *     url: 'ws://127.0.0.1:8080',
 *     autoPlay: false
 * });
 * await client.connect();
 * // Later: manually trigger playback
 * client.startPlayback();
 * ```
 *
 * @fires AutoPlayClient#playback:start - When playback begins
 * @fires AutoPlayClient#playback:end - When playback completes
 * @fires AutoPlayClient#playback:error - When playback fails
 */
export class AutoPlayClient extends AudioStreamClient {
    private player: FFplayAudioPlayer;
    private autoPlay: boolean;
    private playbackPromise: Promise<void> | null = null;
    private playbackStarted: boolean = false;
    private playbackResolve: ((stats: StreamStats) => void) | null = null;
    private playbackReject: ((error: Error) => void) | null = null;
    private pendingStream: { stream: Readable; format: AudioFormat } | null = null;

    /**
     * Creates a new AutoPlayClient.
     *
     * @param config - Client configuration including URL and playback options
     */
    constructor(config: AutoPlayClientConfig) {
        super(config);
        this.autoPlay = config.autoPlay ?? true;
        this.player = new FFplayAudioPlayer();

        // Register stream callback for auto-play
        this.onStream((streamId, format, stream) => {
            if (this.autoPlay && !this.playbackStarted) {
                this.startPlaybackInternal(stream, format);
            } else if (!this.autoPlay) {
                // Store for manual playback later
                this.pendingStream = { stream, format };
            }
        });
    }

    /**
     * Waits for audio playback to complete.
     * This includes both receiving all chunks and playing them through FFplay.
     *
     * @returns Promise resolving to stream statistics when playback completes
     */
    waitForPlayback(): Promise<StreamStats> {
        return new Promise((resolve, reject) => {
            this.playbackResolve = resolve;
            this.playbackReject = reject;

            // If playback already completed, resolve immediately
            if (this.receiver.isComplete() && !this.playbackPromise) {
                resolve(this.receiver.getStats());
            }
        });
    }

    /**
     * Manually starts playback.
     * Only needed if autoPlay is false.
     *
     * @throws Error if no stream is available
     */
    startPlayback(): void {
        if (this.playbackStarted) {
            return;
        }

        if (this.pendingStream) {
            this.startPlaybackInternal(this.pendingStream.stream, this.pendingStream.format);
            this.pendingStream = null;
        } else if (this.receiver.hasStarted()) {
            const stream = this.receiver.getStream();
            const format = this.receiver.getFormat();
            if (format) {
                this.startPlaybackInternal(stream, format);
            } else {
                throw new Error('No audio format available');
            }
        } else {
            throw new Error('No audio stream available');
        }
    }

    /**
     * Stops any currently playing audio.
     * Safe to call even if nothing is playing.
     */
    stopPlayback(): void {
        this.player.stop();
        this.playbackStarted = false;
        this.playbackPromise = null;
    }

    /**
     * Checks if playback is currently active.
     *
     * @returns true if audio is playing
     */
    isPlaying(): boolean {
        return this.playbackStarted && this.playbackPromise !== null;
    }

    /**
     * Disconnects and stops playback.
     */
    override disconnect(): void {
        this.stopPlayback();
        super.disconnect();

        // Reject any pending playback promise
        if (this.playbackReject) {
            this.playbackReject(new Error('Client disconnected'));
            this.playbackResolve = null;
            this.playbackReject = null;
        }
    }

    /**
     * Resets the client for a new stream.
     * Stops any current playback and resets the receiver.
     */
    override resetReceiver(): void {
        this.stopPlayback();
        this.pendingStream = null;
        super.resetReceiver();
    }

    /**
     * Starts playback internally.
     */
    private startPlaybackInternal(stream: Readable, format: AudioFormat): void {
        this.playbackStarted = true;
        this.emit('playback:start', { format });

        this.playbackPromise = this.player.playStream(stream, format)
            .then(() => {
                this.playbackStarted = false;
                this.playbackPromise = null;
                this.emit('playback:end');

                // Resolve any pending waitForPlayback promise
                if (this.playbackResolve) {
                    this.playbackResolve(this.receiver.getStats());
                    this.playbackResolve = null;
                    this.playbackReject = null;
                }
            })
            .catch((error) => {
                this.playbackStarted = false;
                this.playbackPromise = null;

                const errorEvent: StreamErrorEvent = {
                    error,
                    context: 'Playback error',
                };
                this.emit('playback:error', errorEvent);
                this.emit('error', errorEvent);

                // Reject any pending waitForPlayback promise
                if (this.playbackReject) {
                    this.playbackReject(error);
                    this.playbackResolve = null;
                    this.playbackReject = null;
                }
            });
    }
}
