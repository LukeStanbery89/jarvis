/**
 * Tests for validation utilities
 */

import {
    isValidMessage,
    validateRegistrationData,
    sanitizeMetadata,
    validateServerConfig
} from '../src/utils/validation';

describe('Validation Utilities', () => {
    describe('isValidMessage', () => {
        it('should accept valid messages', () => {
            expect(isValidMessage({ type: 'test', id: '123' })).toBe(true);
            expect(isValidMessage({ type: 'chat', timestamp: Date.now() })).toBe(true);
        });

        it('should reject messages without type', () => {
            expect(isValidMessage({})).toBe(false);
            expect(isValidMessage({ id: '123' })).toBe(false);
        });

        it('should reject messages with non-string type', () => {
            expect(isValidMessage({ type: 123 })).toBe(false);
            expect(isValidMessage({ type: null })).toBe(false);
            expect(isValidMessage({ type: undefined })).toBe(false);
        });

        it('should reject messages with empty type', () => {
            expect(isValidMessage({ type: '' })).toBe(false);
        });

        it('should reject messages with type longer than 100 chars', () => {
            const longType = 'a'.repeat(101);
            expect(isValidMessage({ type: longType })).toBe(false);
        });

        it('should reject null or undefined', () => {
            expect(isValidMessage(null)).toBe(false);
            expect(isValidMessage(undefined)).toBe(false);
        });

        it('should reject non-objects', () => {
            expect(isValidMessage('string')).toBe(false);
            expect(isValidMessage(123)).toBe(false);
            expect(isValidMessage(true)).toBe(false);
        });
    });

    describe('validateRegistrationData', () => {
        const defaultConfig = {
            defaultPermissions: [],
            maxMetadataSize: 10000,
            maxCapabilities: 50,
            maxUserAgentLength: 500
        };

        describe('capabilities validation', () => {
            it('should accept valid capabilities', () => {
                expect(() => {
                    validateRegistrationData(['chat', 'tools'], undefined, undefined, defaultConfig);
                }).not.toThrow();
            });

            it('should reject non-array capabilities', () => {
                expect(() => {
                    validateRegistrationData('not-array' as any, undefined, undefined, defaultConfig);
                }).toThrow('Capabilities must be an array');
            });

            it('should reject too many capabilities', () => {
                const tooMany = Array(51).fill('capability');
                expect(() => {
                    validateRegistrationData(tooMany, undefined, undefined, defaultConfig);
                }).toThrow('Too many capabilities');
            });

            it('should reject non-string capabilities', () => {
                expect(() => {
                    validateRegistrationData([123] as any, undefined, undefined, defaultConfig);
                }).toThrow('Each capability must be a non-empty string');
            });

            it('should reject empty string capabilities', () => {
                expect(() => {
                    validateRegistrationData([''], undefined, undefined, defaultConfig);
                }).toThrow('Each capability must be a non-empty string');
            });

            it('should reject capabilities longer than 100 chars', () => {
                const longCapability = 'a'.repeat(101);
                expect(() => {
                    validateRegistrationData([longCapability], undefined, undefined, defaultConfig);
                }).toThrow('Capability name too long');
            });
        });

        describe('userAgent validation', () => {
            it('should accept valid user agents', () => {
                expect(() => {
                    validateRegistrationData([], 'Mozilla/5.0', undefined, defaultConfig);
                }).not.toThrow();
            });

            it('should accept undefined user agent', () => {
                expect(() => {
                    validateRegistrationData([], undefined, undefined, defaultConfig);
                }).not.toThrow();
            });

            it('should reject non-string user agent', () => {
                expect(() => {
                    validateRegistrationData([], 123 as any, undefined, defaultConfig);
                }).toThrow('User agent must be a string');
            });

            it('should reject user agent longer than max length', () => {
                const longUserAgent = 'a'.repeat(501);
                expect(() => {
                    validateRegistrationData([], longUserAgent, undefined, defaultConfig);
                }).toThrow('User agent too long');
            });
        });

        describe('metadata validation', () => {
            it('should accept valid metadata', () => {
                expect(() => {
                    validateRegistrationData([], undefined, { key: 'value' }, defaultConfig);
                }).not.toThrow();
            });

            it('should accept undefined metadata', () => {
                expect(() => {
                    validateRegistrationData([], undefined, undefined, defaultConfig);
                }).not.toThrow();
            });

            it('should reject non-object metadata', () => {
                expect(() => {
                    validateRegistrationData([], undefined, 'not-object' as any, defaultConfig);
                }).toThrow('Metadata must be an object');

                expect(() => {
                    validateRegistrationData([], undefined, null as any, defaultConfig);
                }).toThrow('Metadata must be an object');

                expect(() => {
                    validateRegistrationData([], undefined, [] as any, defaultConfig);
                }).toThrow('Metadata must be an object');
            });

            it('should reject metadata exceeding size limit', () => {
                const largeMetadata = { data: 'a'.repeat(10000) };
                expect(() => {
                    validateRegistrationData([], undefined, largeMetadata, defaultConfig);
                }).toThrow('Metadata too large');
            });

            it('should reject metadata with dangerous keys', () => {
                // Note: These need to be set as own properties, not inherited
                const dangerousMetadata1: any = {};
                Object.defineProperty(dangerousMetadata1, '__proto__', { value: {}, enumerable: true });

                const dangerousMetadata2: any = {};
                Object.defineProperty(dangerousMetadata2, 'constructor', { value: {}, enumerable: true });

                const dangerousMetadata3: any = {};
                Object.defineProperty(dangerousMetadata3, 'prototype', { value: {}, enumerable: true });

                expect(() => {
                    validateRegistrationData([], undefined, dangerousMetadata1, defaultConfig);
                }).toThrow('prototype pollution attempt detected');

                expect(() => {
                    validateRegistrationData([], undefined, dangerousMetadata2, defaultConfig);
                }).toThrow('prototype pollution attempt detected');

                expect(() => {
                    validateRegistrationData([], undefined, dangerousMetadata3, defaultConfig);
                }).toThrow('prototype pollution attempt detected');
            });
        });
    });

    describe('sanitizeMetadata', () => {
        it('should preserve simple types', () => {
            const input = {
                str: 'hello',
                num: 42,
                bool: true,
                nil: null
            };
            const result = sanitizeMetadata(input);
            expect(result).toEqual(input);
        });

        it('should remove dangerous keys', () => {
            const input = {
                safe: 'value',
                __proto__: { dangerous: true },
                constructor: { dangerous: true },
                prototype: { dangerous: true }
            };
            const result = sanitizeMetadata(input);
            expect(result).toEqual({ safe: 'value' });
        });

        it('should filter arrays of simple types', () => {
            const input = {
                arr: ['string', 42, true, null, { nested: 'object' }, undefined]
            };
            const result = sanitizeMetadata(input);
            expect(result.arr).toEqual(['string', 42, true, null]);
        });

        it('should recursively sanitize nested objects', () => {
            const input = {
                nested: {
                    safe: 'value',
                    __proto__: { dangerous: true },
                    deeper: {
                        safe: 'value2',
                        constructor: { dangerous: true }
                    }
                }
            };
            const result = sanitizeMetadata(input);
            expect(result).toEqual({
                nested: {
                    safe: 'value',
                    deeper: {
                        safe: 'value2'
                    }
                }
            });
        });

        it('should remove functions', () => {
            const input = {
                safe: 'value',
                fn: () => {},
                obj: { fn: () => {} }
            };
            const result = sanitizeMetadata(input);
            expect(result).toEqual({
                safe: 'value',
                obj: {}
            });
        });

        it('should handle empty objects', () => {
            expect(sanitizeMetadata({})).toEqual({});
        });
    });

    describe('validateServerConfig', () => {
        it('should accept valid configurations', () => {
            expect(() => {
                validateServerConfig({
                    maxConnections: 100,
                    pingInterval: 30000,
                    clientTimeout: 60000
                });
            }).not.toThrow();
        });

        it('should accept zero maxConnections', () => {
            expect(() => {
                validateServerConfig({ maxConnections: 0 });
            }).not.toThrow();
        });

        it('should reject negative maxConnections', () => {
            expect(() => {
                validateServerConfig({ maxConnections: -1 });
            }).toThrow('maxConnections must be a non-negative number');
        });

        it('should reject non-number maxConnections', () => {
            expect(() => {
                validateServerConfig({ maxConnections: '100' });
            }).toThrow('maxConnections must be a non-negative number');
        });

        it('should reject pingInterval less than 1000ms', () => {
            expect(() => {
                validateServerConfig({ pingInterval: 999 });
            }).toThrow('pingInterval must be >= 1000ms');
        });

        it('should reject non-number pingInterval', () => {
            expect(() => {
                validateServerConfig({ pingInterval: '30000' });
            }).toThrow('pingInterval must be >= 1000ms');
        });

        it('should reject clientTimeout less than 1000ms', () => {
            expect(() => {
                validateServerConfig({ clientTimeout: 999 });
            }).toThrow('clientTimeout must be >= 1000ms');
        });

        it('should accept config with undefined optional fields', () => {
            expect(() => {
                validateServerConfig({});
            }).not.toThrow();
        });
    });
});
