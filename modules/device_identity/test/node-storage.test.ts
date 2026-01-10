import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { NodeStorageAdapter } from '../src/node/node-storage';

describe('NodeStorageAdapter', () => {
    let storageAdapter: NodeStorageAdapter;
    let testDir: string;

    beforeEach(async () => {
        // Create a temporary test directory
        testDir = path.join(os.tmpdir(), `jarvis-test-${Date.now()}`);
        storageAdapter = new NodeStorageAdapter(testDir);
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('set and get', () => {
        it('should store and retrieve a value', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);
            const retrieved = await storageAdapter.get(key);

            expect(retrieved).toBe(value);
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

        it('should handle keys with special characters', async () => {
            const key = 'test@key#with$special%chars';
            const value = 'test_value';

            await storageAdapter.set(key, value);
            const retrieved = await storageAdapter.get(key);

            expect(retrieved).toBe(value);
        });

        it('should create storage directory if it does not exist', async () => {
            const key = 'test_key';
            const value = 'test_value';

            await storageAdapter.set(key, value);

            const dirExists = await fs.stat(testDir).then(() => true).catch(() => false);
            expect(dirExists).toBe(true);
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
        });

        it('should not throw when removing non-existent key', async () => {
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

        it('should handle large values', async () => {
            const key = 'test_key';
            const value = 'x'.repeat(10000);

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
