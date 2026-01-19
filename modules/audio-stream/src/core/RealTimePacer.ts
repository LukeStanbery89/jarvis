import { EventEmitter } from 'events';

/**
 * Configuration options for RealTimePacer.
 */
export interface RealTimePacerConfig {
    /**
     * Whether pacing is enabled.
     * When false, items are emitted immediately without delays.
     * @default true
     */
    enabled?: boolean;
}

/**
 * Item to be paced with its associated delay.
 */
export interface PacedItem<T> {
    /** The item to emit */
    item: T;

    /** Delay in milliseconds before emitting the next item */
    delayMs: number;

    /** Whether this is the final item (no delay after) */
    isFinal?: boolean;
}

/**
 * Utility for pacing item emission to match real-time timing.
 * Used to simulate real-time audio streaming where chunks are emitted
 * at intervals matching their duration.
 *
 * @typeParam T - The type of items being paced
 *
 * @example
 * ```typescript
 * const pacer = new RealTimePacer<AudioChunk>();
 *
 * pacer.on('item', (chunk) => {
 *     socket.emit('audio_chunk', chunk);
 * });
 *
 * pacer.on('complete', () => {
 *     console.log('All chunks sent');
 * });
 *
 * await pacer.pace(chunks.map(c => ({
 *     item: c,
 *     delayMs: c.durationMs,
 *     isFinal: c.isFinal
 * })));
 * ```
 */
export class RealTimePacer<T> extends EventEmitter {
    private enabled: boolean;
    private aborted: boolean = false;
    private currentTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Creates a new RealTimePacer.
     *
     * @param config - Configuration options
     */
    constructor(config?: RealTimePacerConfig) {
        super();
        this.enabled = config?.enabled ?? true;
    }

    /**
     * Paces the emission of items according to their specified delays.
     * Emits 'item' event for each item and 'complete' when done.
     *
     * @param items - Array of items with their delays
     * @returns Promise that resolves when all items have been emitted
     */
    async pace(items: PacedItem<T>[]): Promise<void> {
        this.aborted = false;

        for (const { item, delayMs, isFinal } of items) {
            if (this.aborted) {
                this.emit('aborted');
                return;
            }

            this.emit('item', item);

            // Don't delay after the final item or if pacing is disabled
            if (!isFinal && this.enabled && delayMs > 0) {
                await this.delay(delayMs);
            }
        }

        if (!this.aborted) {
            this.emit('complete');
        }
    }

    /**
     * Paces items from an async generator.
     * Useful for streaming scenarios where items are produced on-demand.
     *
     * @param generator - Async generator yielding paced items
     * @returns Promise that resolves when the generator is exhausted
     */
    async paceGenerator(generator: AsyncGenerator<PacedItem<T>>): Promise<void> {
        this.aborted = false;

        for await (const { item, delayMs, isFinal } of generator) {
            if (this.aborted) {
                this.emit('aborted');
                return;
            }

            this.emit('item', item);

            if (!isFinal && this.enabled && delayMs > 0) {
                await this.delay(delayMs);
            }
        }

        if (!this.aborted) {
            this.emit('complete');
        }
    }

    /**
     * Aborts the current pacing operation.
     * Any pending delays are cancelled and no more items will be emitted.
     */
    abort(): void {
        this.aborted = true;
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }

    /**
     * Checks if pacing is currently enabled.
     *
     * @returns true if pacing delays are applied
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Enables or disables pacing.
     *
     * @param enabled - Whether to enable pacing
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Creates a promise that resolves after the specified delay.
     * The timeout reference is stored so it can be cancelled on abort.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.currentTimeout = setTimeout(() => {
                this.currentTimeout = null;
                resolve();
            }, ms);
        });
    }
}
