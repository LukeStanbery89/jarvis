import { BrowserStorageAdapter } from '../src/browser/browser-storage';

// Mock chrome.storage API
const mockStorage: { [key: string]: any } = {};

global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys: string[]) => {
                const result: { [key: string]: any } = {};
                keys.forEach(key => {
                    if (mockStorage[key] !== undefined) {
                        result[key] = mockStorage[key];
                    }
                });
                return Promise.resolve(result);
            }),
            set: jest.fn((items: { [key: string]: any }) => {
                Object.assign(mockStorage, items);
                return Promise.resolve();
            }),
            remove: jest.fn((keys: string[]) => {
                keys.forEach(key => {
                    delete mockStorage[key];
                });
                return Promise.resolve();
            })
        }
    }
} as any;

describe('BrowserStorageAdapter', () => {
    let storageAdapter: BrowserStorageAdapter;

    beforeEach(() => {
        // Clear mock storage before each test
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        jest.clearAllMocks();
        storageAdapter = new BrowserStorageAdapter();
    });

    describe('set and get', () => {
        it('should store and retrieve a value', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);
            const retrieved = await storageAdapter.get(key);

            expect(retrieved).toBe(value);
            expect(chrome.storage.local.set).toHaveBeenCalled();
            expect(chrome.storage.local.get).toHaveBeenCalled();
        });

        it('should return null for non-existent key', async () => {
            const retrieved = await storageAdapter.get('non_existent_key');
            expect(retrieved).toBeNull();
        });

        it('should overwrite existing value', async () => {
            const key = 'test_key';

            await storageAdapter.set(key, 'value1');
            await storageAdapter.set(key, 'value2');

            const retrieved = await storageAdapter.get(key);
            expect(retrieved).toBe('value2');
        });

        it('should use jarvis_ prefix for storage keys', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);

            expect(mockStorage['jarvis_test_key']).toBe(value);
        });
    });

    describe('remove', () => {
        it('should remove an existing key', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);
            await storageAdapter.remove(key);

            const retrieved = await storageAdapter.get(key);
            expect(retrieved).toBeNull();
            expect(chrome.storage.local.remove).toHaveBeenCalled();
        });

        it('should handle removing non-existent key', async () => {
            await expect(storageAdapter.remove('non_existent_key')).resolves.not.toThrow();
        });
    });

    describe('has', () => {
        it('should return true for existing key', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);
            const exists = await storageAdapter.has(key);

            expect(exists).toBe(true);
        });

        it('should return false for non-existent key', async () => {
            const exists = await storageAdapter.has('non_existent_key');
            expect(exists).toBe(false);
        });

        it('should return false after key is removed', async () => {
            const key = 'test_key';

            await storageAdapter.set(key, 'value');
            await storageAdapter.remove(key);

            const exists = await storageAdapter.has(key);
            expect(exists).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle empty string values', async () => {
            const key = 'test_key';
            const value = '';

            await storageAdapter.set(key, value);
            const retrieved = await storageAdapter.get(key);

            expect(retrieved).toBe(value);
        });

        it('should handle JSON strings', async () => {
            const key = 'test_key';
            const value = JSON.stringify({ foo: 'bar', baz: 123 });

            await storageAdapter.set(key, value);
            const retrieved = await storageAdapter.get(key);

            expect(retrieved).toBe(value);
            expect(JSON.parse(retrieved!)).toEqual({ foo: 'bar', baz: 123 });
        });
    });
});
