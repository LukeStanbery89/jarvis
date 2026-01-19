import { RealTimePacer, PacedItem } from '../../src/core/RealTimePacer.js';

describe('RealTimePacer', () => {
    describe('constructor', () => {
        it('should create with default config (pacing enabled)', () => {
            const pacer = new RealTimePacer();
            expect(pacer.isEnabled()).toBe(true);
        });

        it('should create with pacing disabled', () => {
            const pacer = new RealTimePacer({ enabled: false });
            expect(pacer.isEnabled()).toBe(false);
        });
    });

    describe('pace', () => {
        it('should emit all items in order', async () => {
            const pacer = new RealTimePacer({ enabled: false });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 10 },
                { item: 2, delayMs: 10 },
                { item: 3, delayMs: 10, isFinal: true },
            ];

            const emitted: number[] = [];
            pacer.on('item', (item: number) => {
                emitted.push(item);
            });

            await pacer.pace(items);

            expect(emitted).toEqual([1, 2, 3]);
        });

        it('should emit complete event when done', async () => {
            const pacer = new RealTimePacer({ enabled: false });
            const items: PacedItem<string>[] = [
                { item: 'a', delayMs: 0 },
                { item: 'b', delayMs: 0, isFinal: true },
            ];

            let completeEmitted = false;
            pacer.on('complete', () => {
                completeEmitted = true;
            });

            await pacer.pace(items);

            expect(completeEmitted).toBe(true);
        });

        it('should not delay after final item', async () => {
            const pacer = new RealTimePacer({ enabled: true });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 1000, isFinal: true },
            ];

            const startTime = Date.now();
            await pacer.pace(items);
            const elapsed = Date.now() - startTime;

            // Should complete almost immediately since final item has no delay
            expect(elapsed).toBeLessThan(100);
        });

        it('should apply delays when pacing is enabled', async () => {
            const pacer = new RealTimePacer({ enabled: true });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 50 },
                { item: 2, delayMs: 50, isFinal: true },
            ];

            const startTime = Date.now();
            await pacer.pace(items);
            const elapsed = Date.now() - startTime;

            // Should have delayed ~50ms (one delay, final item skipped)
            expect(elapsed).toBeGreaterThanOrEqual(40);
            expect(elapsed).toBeLessThan(200);
        });

        it('should not apply delays when pacing is disabled', async () => {
            const pacer = new RealTimePacer({ enabled: false });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 100 },
                { item: 2, delayMs: 100 },
                { item: 3, delayMs: 100, isFinal: true },
            ];

            const startTime = Date.now();
            await pacer.pace(items);
            const elapsed = Date.now() - startTime;

            // Should complete almost immediately
            expect(elapsed).toBeLessThan(50);
        });

        it('should handle empty array', async () => {
            const pacer = new RealTimePacer();
            const items: PacedItem<number>[] = [];

            let completeEmitted = false;
            pacer.on('complete', () => {
                completeEmitted = true;
            });

            await pacer.pace(items);

            expect(completeEmitted).toBe(true);
        });
    });

    describe('abort', () => {
        it('should stop emitting items when aborted', async () => {
            const pacer = new RealTimePacer({ enabled: true });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 100 },
                { item: 2, delayMs: 100 },
                { item: 3, delayMs: 100, isFinal: true },
            ];

            const emitted: number[] = [];
            pacer.on('item', (item: number) => {
                emitted.push(item);
                if (item === 1) {
                    pacer.abort();
                }
            });

            let abortedEmitted = false;
            pacer.on('aborted', () => {
                abortedEmitted = true;
            });

            await pacer.pace(items);

            expect(emitted).toEqual([1]);
            expect(abortedEmitted).toBe(true);
        });

        it('should not emit complete when aborted', async () => {
            const pacer = new RealTimePacer({ enabled: true });
            const items: PacedItem<number>[] = [
                { item: 1, delayMs: 100 },
                { item: 2, delayMs: 100, isFinal: true },
            ];

            pacer.on('item', () => {
                pacer.abort();
            });

            let completeEmitted = false;
            pacer.on('complete', () => {
                completeEmitted = true;
            });

            await pacer.pace(items);

            expect(completeEmitted).toBe(false);
        });
    });

    describe('setEnabled', () => {
        it('should change pacing state', () => {
            const pacer = new RealTimePacer({ enabled: true });

            expect(pacer.isEnabled()).toBe(true);

            pacer.setEnabled(false);
            expect(pacer.isEnabled()).toBe(false);

            pacer.setEnabled(true);
            expect(pacer.isEnabled()).toBe(true);
        });
    });

    describe('paceGenerator', () => {
        it('should pace items from async generator', async () => {
            const pacer = new RealTimePacer({ enabled: false });

            async function* generateItems(): AsyncGenerator<PacedItem<number>> {
                yield { item: 1, delayMs: 10 };
                yield { item: 2, delayMs: 10 };
                yield { item: 3, delayMs: 10, isFinal: true };
            }

            const emitted: number[] = [];
            pacer.on('item', (item: number) => {
                emitted.push(item);
            });

            await pacer.paceGenerator(generateItems());

            expect(emitted).toEqual([1, 2, 3]);
        });

        it('should stop when aborted during generator iteration', async () => {
            const pacer = new RealTimePacer({ enabled: true });

            async function* generateItems(): AsyncGenerator<PacedItem<number>> {
                yield { item: 1, delayMs: 100 };
                yield { item: 2, delayMs: 100 };
                yield { item: 3, delayMs: 100, isFinal: true };
            }

            const emitted: number[] = [];
            pacer.on('item', (item: number) => {
                emitted.push(item);
                if (item === 1) {
                    pacer.abort();
                }
            });

            await pacer.paceGenerator(generateItems());

            expect(emitted).toEqual([1]);
        });
    });
});
