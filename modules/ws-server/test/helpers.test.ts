/**
 * Tests for helper utilities
 */

import {
    generateMessageId,
    generateSessionId,
    isValidMessageId,
    isValidSessionId,
    createTimestamp,
    formatTimestampForLog,
    sanitizeForLogging,
    deepClone,
    hasRequiredProperties,
    SimpleRateLimiter
} from '../src/utils/helpers';

describe('Helper Utilities', () => {
    describe('ID generation', () => {
        describe('generateMessageId', () => {
            it('should generate valid message ID', () => {
                const id = generateMessageId();
                expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);
            });

            it('should generate unique IDs', () => {
                const ids = Array.from({ length: 100 }, () => generateMessageId());
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(100);
            });
        });

        describe('generateSessionId', () => {
            it('should generate valid session ID', () => {
                const id = generateSessionId();
                expect(id).toMatch(/^session_\d+_[a-z0-9]+$/);
            });

            it('should generate unique IDs', () => {
                const ids = Array.from({ length: 100 }, () => generateSessionId());
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(100);
            });

            it('should generate longer IDs than message IDs', () => {
                const msgId = generateMessageId();
                const sessionId = generateSessionId();
                expect(sessionId.length).toBeGreaterThan(msgId.length);
            });
        });
    });

    describe('ID validation', () => {
        describe('isValidMessageId', () => {
            it('should validate correct message IDs', () => {
                expect(isValidMessageId('msg_1234567890_abc123xyz')).toBe(true);
                expect(isValidMessageId(generateMessageId())).toBe(true);
            });

            it('should reject invalid message IDs', () => {
                expect(isValidMessageId('')).toBe(false);
                expect(isValidMessageId('invalid')).toBe(false);
                expect(isValidMessageId('session_123_abc')).toBe(false);
                expect(isValidMessageId('msg_abc_123')).toBe(false); // timestamp not numeric
                expect(isValidMessageId('msg_123_')).toBe(false); // empty suffix
            });

            it('should reject non-strings', () => {
                expect(isValidMessageId(null as any)).toBe(false);
                expect(isValidMessageId(undefined as any)).toBe(false);
                expect(isValidMessageId(123 as any)).toBe(false);
            });
        });

        describe('isValidSessionId', () => {
            it('should validate correct session IDs', () => {
                expect(isValidSessionId('session_1234567890_abc123xyz')).toBe(true);
                expect(isValidSessionId(generateSessionId())).toBe(true);
            });

            it('should reject invalid session IDs', () => {
                expect(isValidSessionId('')).toBe(false);
                expect(isValidSessionId('invalid')).toBe(false);
                expect(isValidSessionId('msg_123_abc')).toBe(false);
                expect(isValidSessionId('session_abc_123')).toBe(false);
            });
        });
    });

    describe('timestamp utilities', () => {
        describe('createTimestamp', () => {
            it('should create timestamp', () => {
                const ts = createTimestamp();
                expect(typeof ts).toBe('number');
                expect(ts).toBeGreaterThan(0);
                expect(ts).toBeLessThanOrEqual(Date.now());
            });
        });

        describe('formatTimestampForLog', () => {
            it('should format timestamp as ISO string', () => {
                const ts = Date.now();
                const formatted = formatTimestampForLog(ts);
                expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                expect(new Date(formatted).getTime()).toBe(ts);
            });
        });
    });

    describe('sanitizeForLogging', () => {
        it('should redact API keys', () => {
            const result = sanitizeForLogging('api_key: sk-1234567890abcdef');
            expect(result).toContain('API_KEY_REDACTED');
            expect(result).not.toContain('sk-1234567890abcdef');
        });

        it('should redact tokens', () => {
            const result = sanitizeForLogging('token: eyJhbGciOiJIUzI1NiIsInR5cCI');
            expect(result).toContain('TOKEN_REDACTED');
            expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI');
        });

        it('should redact passwords', () => {
            const result = sanitizeForLogging('password: secret123');
            expect(result).toContain('PASSWORD_REDACTED');
            expect(result).not.toContain('secret123');
        });

        it('should redact secrets', () => {
            const result = sanitizeForLogging('secret: mysecretvalue');
            expect(result).toContain('SECRET_REDACTED');
            expect(result).not.toContain('mysecretvalue');
        });

        it('should truncate long strings', () => {
            const longString = 'a'.repeat(200);
            const result = sanitizeForLogging(longString);
            expect(result.length).toBe(103); // 100 chars + '...'
            expect(result.endsWith('...')).toBe(true);
        });

        it('should respect custom max length', () => {
            const result = sanitizeForLogging('hello world', 5);
            expect(result).toBe('hello...');
        });

        it('should handle invalid inputs', () => {
            expect(sanitizeForLogging(null as any)).toBe('[invalid string]');
            expect(sanitizeForLogging(undefined as any)).toBe('[invalid string]');
            expect(sanitizeForLogging(123 as any)).toBe('[invalid string]');
        });
    });

    describe('deepClone', () => {
        it('should clone primitives', () => {
            expect(deepClone(null)).toBe(null);
            expect(deepClone(42)).toBe(42);
            expect(deepClone('hello')).toBe('hello');
            expect(deepClone(true)).toBe(true);
        });

        it('should clone Date objects', () => {
            const date = new Date();
            const cloned = deepClone(date);
            expect(cloned).toEqual(date);
            expect(cloned).not.toBe(date);
        });

        it('should clone arrays', () => {
            const arr = [1, 2, { a: 3 }];
            const cloned = deepClone(arr);
            expect(cloned).toEqual(arr);
            expect(cloned).not.toBe(arr);
            expect(cloned[2]).not.toBe(arr[2]);
        });

        it('should clone nested objects', () => {
            const obj = {
                a: 1,
                b: {
                    c: 2,
                    d: {
                        e: 3
                    }
                }
            };
            const cloned = deepClone(obj);
            expect(cloned).toEqual(obj);
            expect(cloned).not.toBe(obj);
            expect(cloned.b).not.toBe(obj.b);
            expect(cloned.b.d).not.toBe(obj.b.d);
        });

        it('should handle circular references', () => {
            const obj: any = { a: 1 };
            obj.self = obj;

            const cloned = deepClone(obj as any) as any;

            expect(cloned).not.toBe(obj);
            expect(cloned.a).toBe(1);
            // The circular reference should be preserved in the clone
            expect(cloned.self).toBe(cloned);
        });
    });

    describe('hasRequiredProperties', () => {
        it('should return true when all properties present', () => {
            expect(hasRequiredProperties({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
            expect(hasRequiredProperties({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(true);
        });

        it('should return false when properties missing', () => {
            expect(hasRequiredProperties({ a: 1 }, ['a', 'b'])).toBe(false);
            expect(hasRequiredProperties({}, ['a'])).toBe(false);
        });

        it('should return true for empty requirements', () => {
            expect(hasRequiredProperties({ a: 1 }, [])).toBe(true);
        });

        it('should handle non-objects', () => {
            expect(hasRequiredProperties(null, ['a'])).toBe(false);
            expect(hasRequiredProperties(undefined, ['a'])).toBe(false);
            expect(hasRequiredProperties('string' as any, ['a'])).toBe(false);
        });
    });

    describe('SimpleRateLimiter', () => {
        it('should allow requests within limit', () => {
            const limiter = new SimpleRateLimiter(5, 1000);

            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
        });

        it('should reject requests over limit', () => {
            const limiter = new SimpleRateLimiter(3, 1000);

            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(false);
            expect(limiter.isAllowed('client1')).toBe(false);
        });

        it('should track clients independently', () => {
            const limiter = new SimpleRateLimiter(2, 1000);

            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client2')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client2')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(false);
            expect(limiter.isAllowed('client2')).toBe(false);
        });

        it('should reset after time window', (done) => {
            const limiter = new SimpleRateLimiter(2, 100); // 100ms window

            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(false);

            setTimeout(() => {
                expect(limiter.isAllowed('client1')).toBe(true);
                done();
            }, 150);
        });

        it('should reset specific client', () => {
            const limiter = new SimpleRateLimiter(2, 1000);

            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(true);
            expect(limiter.isAllowed('client1')).toBe(false);

            limiter.reset('client1');

            expect(limiter.isAllowed('client1')).toBe(true);
        });

        it('should cleanup old entries', (done) => {
            const limiter = new SimpleRateLimiter(5, 100);

            limiter.isAllowed('client1');
            limiter.isAllowed('client2');
            limiter.isAllowed('client3');

            setTimeout(() => {
                limiter.cleanup();

                // After cleanup, internal request map should be cleared for old entries
                const internal = (limiter as any).requests as Map<string, number[]>;
                expect(internal).toBeDefined();
                expect(internal.size).toBe(0);
                done();
            }, 150);
        });
    });
});
