import { Memoization, memoize, Memoized } from '../src/Memoization';

describe('Memoization', () => {
    beforeEach(() => {
        // Reset caches between tests
        Memoization.clearAllCaches();
    });

    it('caches results and returns cached value', async () => {
        let calls = 0;
        const fn = async (n: number) => {
            calls++;
            return n + 1;
        };

        const memo = memoize(fn, { ttl: 10000 }, 'testCache');

        const a = await memo(1);
        const b = await memo(1);
        expect(a).toBe(2);
        expect(b).toBe(2);
        expect(calls).toBe(1);
    });

    it('clears cache when clearCache is called', async () => {
        let calls = 0;
        const fn = async (n: number) => {
            calls++;
            return n * 2;
        };

        const memo = memoize(fn, { ttl: 10000 }, 'clearTest');

        await memo(2);
        expect(calls).toBe(1);

        Memoization.clearCache('clearTest');

        await memo(2);
        expect(calls).toBe(2);
    });

    it('provides cache stats and ids', async () => {
        const fn = async (n: number) => n;
        const memo = memoize(fn, { ttl: 10000 }, 'statsTest');

        await memo(5);

        const stats = Memoization.getCacheStats('statsTest');
        expect(stats).not.toBeNull();
        if (stats) {
            expect(stats.size).toBeGreaterThanOrEqual(1);
            expect(stats.entries.length).toBeGreaterThanOrEqual(1);
        }

        const ids = Memoization.getAllCacheIds();
        expect(ids).toContain('statsTest');
    });

    it('works when applying memoization to a prototype method', async () => {
        let calls = 0;

        class Svc {
            async compute(x: number) {
                calls++;
                return x * 3;
            }
        }

        // Apply memoization to the prototype method (simulates decorator behavior)
        (Svc.prototype as any).compute = Memoization.memoize((Svc.prototype as any).compute, { ttl: 10000 }, 'Svc.compute');

        const s = new Svc();
        const r1 = await s.compute(2);
        const r2 = await s.compute(2);
        expect(r1).toBe(6);
        expect(r2).toBe(6);
        expect(calls).toBe(1);
    });
});
