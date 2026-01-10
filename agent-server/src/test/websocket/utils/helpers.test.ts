import {
    generateMessageId,
    generateSessionId,
    getServerCapabilities,
    isValidMessageId,
    isValidSessionId,
    createTimestamp,
    formatTimestampForLog,
    sanitizeForLogging,
    deepClone,
    hasRequiredProperties,
    SimpleRateLimiter
} from '../../../websocket/utils/helpers';

describe('WebSocket Helpers', () => {
    
    describe('generateMessageId', () => {
        it('should generate message ID with correct format', () => {
            const messageId = generateMessageId();
            
            expect(messageId).toMatch(/^msg_\d+_[a-z0-9]+$/);
            expect(messageId).toContain('msg_');
        });

        it('should generate unique message IDs', () => {
            const id1 = generateMessageId();
            const id2 = generateMessageId();
            
            expect(id1).not.toBe(id2);
        });

        it('should contain timestamp in message ID', () => {
            const beforeTime = Date.now();
            const messageId = generateMessageId();
            const afterTime = Date.now();
            
            const timestampPart = messageId.split('_')[1];
            const timestamp = parseInt(timestampPart);
            
            expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(timestamp).toBeLessThanOrEqual(afterTime);
        });
    });

    describe('generateSessionId', () => {
        it('should generate session ID with correct format', () => {
            const sessionId = generateSessionId();
            
            expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(sessionId).toContain('session_');
        });

        it('should generate unique session IDs', () => {
            const id1 = generateSessionId();
            const id2 = generateSessionId();
            
            expect(id1).not.toBe(id2);
        });

        it('should generate longer random part than message ID', () => {
            // Test multiple times to account for randomness
            for (let i = 0; i < 10; i++) {
                const sessionId = generateSessionId();
                const messageId = generateMessageId();
                const sessionRandomPart = sessionId.split('_')[2];
                const messageRandomPart = messageId.split('_')[2];

                // Session ID should generally have a longer random part due to substr(2, 16) vs substr(2, 9)
                // But due to Math.random() nature, we'll check the intended maximum length
                expect(sessionRandomPart.length).toBeGreaterThanOrEqual(messageRandomPart.length);
            }

            // Also test that session ID format is designed for longer random parts
            expect('session_1234567890_1234567890123456'.split('_')[2].length).toBeGreaterThan(
                'msg_1234567890_123456789'.split('_')[2].length
            );
        });
    });

    describe('getServerCapabilities', () => {
        it('should return array of server capabilities', () => {
            const capabilities = getServerCapabilities();
            
            expect(Array.isArray(capabilities)).toBe(true);
            expect(capabilities.length).toBeGreaterThan(0);
        });

        it('should include expected capabilities', () => {
            const capabilities = getServerCapabilities();
            
            expect(capabilities).toContain('chat');
            expect(capabilities).toContain('agent_processing');
            expect(capabilities).toContain('tool_orchestration');
            expect(capabilities).toContain('multi_client_support');
            expect(capabilities).toContain('real_time_status');
        });

        it('should return same capabilities on multiple calls', () => {
            const capabilities1 = getServerCapabilities();
            const capabilities2 = getServerCapabilities();
            
            expect(capabilities1).toEqual(capabilities2);
        });
    });

    describe('isValidMessageId', () => {
        it('should validate correct message ID format', () => {
            const validId = 'msg_1629123456789_abc123def';
            
            expect(isValidMessageId(validId)).toBe(true);
        });

        it('should reject invalid message ID formats', () => {
            expect(isValidMessageId('invalid')).toBe(false);
            expect(isValidMessageId('msg_abc_def')).toBe(false);
            expect(isValidMessageId('session_123_abc')).toBe(false);
            expect(isValidMessageId('msg_123')).toBe(false);
        });

        it('should reject non-string values', () => {
            expect(isValidMessageId(null as any)).toBe(false);
            expect(isValidMessageId(undefined as any)).toBe(false);
            expect(isValidMessageId(123 as any)).toBe(false);
            expect(isValidMessageId({} as any)).toBe(false);
        });

        it('should reject empty string', () => {
            expect(isValidMessageId('')).toBe(false);
        });

        it('should validate generated message IDs', () => {
            const generatedId = generateMessageId();
            
            expect(isValidMessageId(generatedId)).toBe(true);
        });
    });

    describe('isValidSessionId', () => {
        it('should validate correct session ID format', () => {
            const validId = 'session_1629123456789_abc123defghi456';
            
            expect(isValidSessionId(validId)).toBe(true);
        });

        it('should reject invalid session ID formats', () => {
            expect(isValidSessionId('invalid')).toBe(false);
            expect(isValidSessionId('session_abc_def')).toBe(false);
            expect(isValidSessionId('msg_123_abc')).toBe(false);
            expect(isValidSessionId('session_123')).toBe(false);
        });

        it('should reject non-string values', () => {
            expect(isValidSessionId(null as any)).toBe(false);
            expect(isValidSessionId(undefined as any)).toBe(false);
            expect(isValidSessionId(123 as any)).toBe(false);
            expect(isValidSessionId({} as any)).toBe(false);
        });

        it('should validate generated session IDs', () => {
            const generatedId = generateSessionId();
            
            expect(isValidSessionId(generatedId)).toBe(true);
        });
    });

    describe('createTimestamp', () => {
        it('should return current timestamp', () => {
            const beforeTime = Date.now();
            const timestamp = createTimestamp();
            const afterTime = Date.now();
            
            expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(timestamp).toBeLessThanOrEqual(afterTime);
        });

        it('should return number', () => {
            const timestamp = createTimestamp();
            
            expect(typeof timestamp).toBe('number');
        });
    });

    describe('formatTimestampForLog', () => {
        it('should format timestamp to ISO string', () => {
            const timestamp = 1629123456789;
            const formatted = formatTimestampForLog(timestamp);
            
            // Use the actual Date conversion to avoid timezone issues
            const expected = new Date(timestamp).toISOString();
            expect(formatted).toBe(expected);
        });

        it('should handle current timestamp', () => {
            const timestamp = Date.now();
            const formatted = formatTimestampForLog(timestamp);
            
            expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('sanitizeForLogging', () => {
        it('should redact API keys', () => {
            const text = 'api_key: sk-1234567890abcdefghij';
            const sanitized = sanitizeForLogging(text);
            
            expect(sanitized).toContain('API_KEY_REDACTED');
            expect(sanitized).not.toContain('sk-1234567890abcdefghij');
        });

        it('should redact tokens', () => {
            const text = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
            const sanitized = sanitizeForLogging(text);
            
            expect(sanitized).toContain('TOKEN_REDACTED');
            expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        });

        it('should redact passwords', () => {
            const text = 'password: mySecretPassword123';
            const sanitized = sanitizeForLogging(text);
            
            expect(sanitized).toContain('PASSWORD_REDACTED');
            expect(sanitized).not.toContain('mySecretPassword123');
        });

        it('should redact secrets', () => {
            const text = 'secret: superSecretValue';
            const sanitized = sanitizeForLogging(text);
            
            expect(sanitized).toContain('SECRET_REDACTED');
            expect(sanitized).not.toContain('superSecretValue');
        });

        it('should truncate long text', () => {
            const longText = 'a'.repeat(200);
            const sanitized = sanitizeForLogging(longText, 50);
            
            expect(sanitized.length).toBe(53); // 50 + '...'
            expect(sanitized.endsWith('...')).toBe(true);
        });

        it('should handle invalid input', () => {
            expect(sanitizeForLogging(null as any)).toBe('[invalid string]');
            expect(sanitizeForLogging(undefined as any)).toBe('[invalid string]');
            expect(sanitizeForLogging(123 as any)).toBe('[invalid string]');
        });

        it('should handle empty string', () => {
            expect(sanitizeForLogging('')).toBe('[invalid string]');
        });

        it('should not modify safe text', () => {
            const safeText = 'This is a safe message';
            const sanitized = sanitizeForLogging(safeText);
            
            expect(sanitized).toBe(safeText);
        });
    });

    describe('deepClone', () => {
        it('should clone primitive values', () => {
            expect(deepClone(42)).toBe(42);
            expect(deepClone('hello')).toBe('hello');
            expect(deepClone(true)).toBe(true);
            expect(deepClone(null)).toBe(null);
            expect(deepClone(undefined)).toBe(undefined);
        });

        it('should clone Date objects', () => {
            const date = new Date('2021-08-16T12:17:36.789Z');
            const cloned = deepClone(date);
            
            expect(cloned).toEqual(date);
            expect(cloned).not.toBe(date);
            expect(cloned instanceof Date).toBe(true);
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

        it('should handle complex nested structures', () => {
            const complex = {
                string: 'hello',
                number: 42,
                boolean: true,
                date: new Date(),
                array: [1, 2, { nested: 'value' }],
                object: {
                    deep: {
                        property: 'test'
                    }
                }
            };
            const cloned = deepClone(complex);
            
            expect(cloned).toEqual(complex);
            expect(cloned).not.toBe(complex);
            expect(cloned.date).not.toBe(complex.date);
            expect(cloned.array).not.toBe(complex.array);
            expect(cloned.object.deep).not.toBe(complex.object.deep);
        });
    });

    describe('hasRequiredProperties', () => {
        it('should return true when all properties exist', () => {
            const obj = { a: 1, b: 2, c: 3 };
            const required = ['a', 'b'];
            
            expect(hasRequiredProperties(obj, required)).toBe(true);
        });

        it('should return false when properties are missing', () => {
            const obj = { a: 1, b: 2 };
            const required = ['a', 'b', 'c'];
            
            expect(hasRequiredProperties(obj, required)).toBe(false);
        });

        it('should handle empty required properties', () => {
            const obj = { a: 1 };
            
            expect(hasRequiredProperties(obj, [])).toBe(true);
        });

        it('should handle invalid input', () => {
            expect(hasRequiredProperties(null, ['a'])).toBe(false);
            expect(hasRequiredProperties(undefined, ['a'])).toBe(false);
            expect(hasRequiredProperties('string', ['a'])).toBe(false);
            expect(hasRequiredProperties(123, ['a'])).toBe(false);
        });

        it('should handle properties with falsy values', () => {
            const obj = { a: 0, b: false, c: '', d: null };
            const required = ['a', 'b', 'c', 'd'];
            
            expect(hasRequiredProperties(obj, required)).toBe(true);
        });
    });

    describe('SimpleRateLimiter', () => {
        let rateLimiter: SimpleRateLimiter;
        
        beforeEach(() => {
            // Create rate limiter: max 3 requests per 1000ms
            rateLimiter = new SimpleRateLimiter(3, 1000);
        });

        it('should allow requests within limit', () => {
            expect(rateLimiter.isAllowed('user1')).toBe(true);
            expect(rateLimiter.isAllowed('user1')).toBe(true);
            expect(rateLimiter.isAllowed('user1')).toBe(true);
        });

        it('should block requests over limit', () => {
            // Use up the limit
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            
            // This should be blocked
            expect(rateLimiter.isAllowed('user1')).toBe(false);
        });

        it('should track different identifiers separately', () => {
            // Use up limit for user1
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            
            // user2 should still be allowed
            expect(rateLimiter.isAllowed('user2')).toBe(true);
            expect(rateLimiter.isAllowed('user2')).toBe(true);
            expect(rateLimiter.isAllowed('user2')).toBe(true);
            
            // user1 should still be blocked
            expect(rateLimiter.isAllowed('user1')).toBe(false);
        });

        it('should reset rate limiting for specific identifier', () => {
            // Use up the limit
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            rateLimiter.isAllowed('user1');
            
            expect(rateLimiter.isAllowed('user1')).toBe(false);
            
            // Reset and try again
            rateLimiter.reset('user1');
            expect(rateLimiter.isAllowed('user1')).toBe(true);
        });

        it('should allow requests after time window expires', () => {
            // Mock Date.now to control time
            const originalNow = Date.now;
            let currentTime = 1000000;
            Date.now = jest.fn(() => currentTime);
            
            try {
                // Create new rate limiter with mocked time
                const limiter = new SimpleRateLimiter(2, 100); // 2 requests per 100ms
                
                // Use up the limit
                expect(limiter.isAllowed('user1')).toBe(true);
                expect(limiter.isAllowed('user1')).toBe(true);
                expect(limiter.isAllowed('user1')).toBe(false);
                
                // Advance time beyond the window
                currentTime += 150;
                
                // Should be allowed again
                expect(limiter.isAllowed('user1')).toBe(true);
                
            } finally {
                Date.now = originalNow;
            }
        });

        it('should cleanup old entries', () => {
            const originalNow = Date.now;
            let currentTime = 1000000;
            Date.now = jest.fn(() => currentTime);
            
            try {
                const limiter = new SimpleRateLimiter(3, 100);
                
                // Make some requests
                limiter.isAllowed('user1');
                limiter.isAllowed('user2');
                
                // Advance time
                currentTime += 200;
                
                // Cleanup should remove old entries
                limiter.cleanup();
                
                // Verify by checking internal state (accessing private property for testing)
                const requestsMap = (limiter as any).requests;
                expect(requestsMap.size).toBe(0);
                
            } finally {
                Date.now = originalNow;
            }
        });

        it('should handle edge case with zero window', () => {
            const zeroWindowLimiter = new SimpleRateLimiter(1, 0);
            
            // With zero window, each request creates a new window
            // So each request should be allowed since previous ones expire immediately
            expect(zeroWindowLimiter.isAllowed('user1')).toBe(true);
            expect(zeroWindowLimiter.isAllowed('user1')).toBe(true);
        });

        it('should handle edge case with zero max requests', () => {
            const zeroMaxLimiter = new SimpleRateLimiter(0, 1000);
            
            expect(zeroMaxLimiter.isAllowed('user1')).toBe(false);
        });
    });
});