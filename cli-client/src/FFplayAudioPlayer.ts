import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { AudioPlayer, AudioFormat } from './types.js';

/**
 * AudioPlayer implementation using FFplay.
 * Handles PCM stream playback via FFmpeg's ffplay utility.
 */
export class FFplayAudioPlayer implements AudioPlayer {
    private ffplay: ChildProcess | null = null;
    private currentStream: Readable | null = null;

    /**
     * Plays audio from a Readable stream using FFplay.
     * @param stream - The audio data stream (PCM format)
     * @param format - The audio format specification
     * @returns Promise that resolves when playback completes
     */
    async playStream(stream: Readable, format: AudioFormat): Promise<void> {
        // Stop any existing playback
        this.stop();

        this.currentStream = stream;

        const args = [
            '-nodisp',
            '-autoexit',
            '-hide_banner',
            '-f', format.encoding,
            '-ar', format.sampleRate.toString(),
        ];

        // ffplay uses -ch_layout instead of -ac for channel specification
        if (format.channels === 1) {
            args.push('-ch_layout', 'mono');
        } else if (format.channels === 2) {
            args.push('-ch_layout', 'stereo');
        }

        args.push('-');

        this.ffplay = spawn('ffplay', args);

        return new Promise((resolve, reject) => {
            if (!this.ffplay) {
                reject(new Error('Failed to spawn ffplay'));
                return;
            }

            let stderr = '';

            this.ffplay.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            this.ffplay.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ENOENT') {
                    reject(new Error(
                        'FFplay not found. Please install FFmpeg with ffplay included.\n' +
                        'On macOS: brew install ffmpeg\n' +
                        'On Linux: sudo apt-get install ffmpeg'
                    ));
                } else {
                    reject(new Error(`Failed to spawn FFplay: ${err.message}`));
                }
            });

            // Pipe the stream to ffplay's stdin
            if (this.ffplay.stdin) {
                stream.pipe(this.ffplay.stdin);

                this.ffplay.stdin.on('error', (err: NodeJS.ErrnoException) => {
                    // EPIPE is normal when ffplay closes early
                    if (err.code !== 'EPIPE') {
                        reject(new Error(`FFplay stdin error: ${err.message}`));
                    }
                });
            }

            this.ffplay.on('close', (code: number | null) => {
                this.ffplay = null;
                this.currentStream = null;

                if (code === 0 || code === null) {
                    resolve();
                } else {
                    reject(new Error(
                        `FFplay exited with code ${code}` +
                        (stderr ? `:\n${stderr}` : '')
                    ));
                }
            });
        });
    }

    /**
     * Stops any currently playing audio.
     * Safe to call even if nothing is playing.
     */
    stop(): void {
        if (this.currentStream) {
            this.currentStream.destroy();
            this.currentStream = null;
        }
        if (this.ffplay) {
            this.ffplay.kill('SIGTERM');
            this.ffplay = null;
        }
    }
}
