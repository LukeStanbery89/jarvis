import { logger } from './logger';

/**
 * Cache entry with TTL support
 */
interface ICacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
}

/**
 * Memoization options
 */
interface IMemoizationOptions {
    /**
     * Time-to-live in milliseconds (default: 30 seconds)
     */
    ttl?: number;
    
    /**
     * Custom cache key generator function
     * If not provided, uses JSON.stringify of arguments
     */
    keyGenerator?: (...args: any[]) => string;
    
    /**
     * Maximum number of cached entries (default: 100)
     * Prevents memory leaks in long-running processes
     */
    maxEntries?: number;

    /**
     * Enable debug logging for cache hits/misses
     */
    debug?: boolean;
}

/**
 * General-purpose memoization utility with TTL support
 * 
 * Features:
 * - Time-based cache expiration
 * - Custom key generation
 * - Memory leak prevention with max entries
 * - Debug logging
 * - Thread-safe operations
 * 
 * Example usage:
 * ```typescript
 * const memoizedFetch = memoize(expensiveApiCall, { ttl: 30000 });
 * const result = await memoizedFetch(param1, param2);
 * ```
 */
export class Memoization {
    private static caches = new Map<string, Map<string, ICacheEntry<any>>>();

    /**
     * Create a memoized version of a function
     */
    static memoize<TArgs extends any[], TReturn>(
        fn: (...args: TArgs) => Promise<TReturn>,
        options: IMemoizationOptions = {},
        cacheId?: string
    ): (...args: TArgs) => Promise<TReturn> {
        const {
            ttl = 30000, // 30 seconds default
            keyGenerator = (...args: any[]) => JSON.stringify(args),
            maxEntries = 100,
            debug = false
        } = options;

        // Create unique cache ID based on function name or provided ID
        const finalCacheId = cacheId || fn.name || `anonymous_${Date.now()}`;
        
        // Initialize cache for this function if not exists
        if (!this.caches.has(finalCacheId)) {
            this.caches.set(finalCacheId, new Map());
        }
        
        const cache = this.caches.get(finalCacheId)!;

        return async (...args: TArgs): Promise<TReturn> => {
            const key = keyGenerator(...args);
            const now = Date.now();
            
            // Check if we have a valid cached entry
            const cached = cache.get(key);
            if (cached && (now - cached.timestamp) < cached.ttl) {
                if (debug) {
                    logger.debug('Memoization cache hit', {
                        utility: 'Memoization',
                        cacheId: finalCacheId,
                        key,
                        age: now - cached.timestamp,
                        ttl: cached.ttl
                    });
                }
                return cached.value;
            }

            // Cache miss - execute function
            if (debug) {
                logger.debug('Memoization cache miss', {
                    utility: 'Memoization',
                    cacheId: finalCacheId,
                    key,
                    reason: cached ? 'expired' : 'not_found'
                });
            }

            const result = await fn(...args);
            
            // Store in cache
            cache.set(key, {
                value: result,
                timestamp: now,
                ttl
            });

            // Prevent memory leaks by limiting cache size
            if (cache.size > maxEntries) {
                // Remove oldest entry
                const oldestKey = cache.keys().next().value;
                if (oldestKey) {
                    cache.delete(oldestKey);
                    
                    if (debug) {
                        logger.debug('Memoization cache cleanup', {
                            utility: 'Memoization',
                            cacheId: finalCacheId,
                            removedKey: oldestKey,
                            currentSize: cache.size
                        });
                    }
                }
            }

            return result;
        };
    }

    /**
     * Clear cache for a specific function
     */
    static clearCache(cacheId: string): void {
        const cache = this.caches.get(cacheId);
        if (cache) {
            cache.clear();
            logger.debug('Memoization cache cleared', {
                utility: 'Memoization',
                cacheId
            });
        }
    }

    /**
     * Clear all caches
     */
    static clearAllCaches(): void {
        this.caches.clear();
        logger.debug('All memoization caches cleared', {
            utility: 'Memoization'
        });
    }

    /**
     * Get cache statistics
     */
    static getCacheStats(cacheId: string): {
        size: number;
        entries: { key: string; age: number; ttl: number }[];
    } | null {
        const cache = this.caches.get(cacheId);
        if (!cache) return null;

        const now = Date.now();
        const entries = Array.from(cache.entries()).map(([key, entry]) => ({
            key,
            age: now - entry.timestamp,
            ttl: entry.ttl
        }));

        return {
            size: cache.size,
            entries
        };
    }

    /**
     * Get all cache IDs
     */
    static getAllCacheIds(): string[] {
        return Array.from(this.caches.keys());
    }
}

/**
 * Convenience function for creating memoized functions
 */
export const memoize = Memoization.memoize.bind(Memoization);

/**
 * Decorator for memoizing class methods
 * 
 * Example:
 * ```typescript
 * class MyService {
 *   @Memoized({ ttl: 60000 })
 *   async expensiveMethod(param: string): Promise<string> {
 *     // expensive operation
 *   }
 * }
 * ```
 */
export function Memoized(options: IMemoizationOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const cacheId = `${target.constructor.name}.${propertyName}`;
        
        descriptor.value = Memoization.memoize(method, options, cacheId);
        
        return descriptor;
    };
}