import { IStorageAdapter } from '../shared/types';

/**
 * Browser Storage Adapter
 * Uses Chrome storage API for persistent storage across extension sessions
 */
export class BrowserStorageAdapter implements IStorageAdapter {
    private readonly STORAGE_PREFIX = 'jarvis_';

    async get(key: string): Promise<string | null> {
        const storageKey = this.STORAGE_PREFIX + key;
        const result = await chrome.storage.local.get([storageKey]);
        return result[storageKey] ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        const storageKey = this.STORAGE_PREFIX + key;
        await chrome.storage.local.set({ [storageKey]: value });
    }

    async remove(key: string): Promise<void> {
        const storageKey = this.STORAGE_PREFIX + key;
        await chrome.storage.local.remove([storageKey]);
    }

    async has(key: string): Promise<boolean> {
        const value = await this.get(key);
        return value !== null;
    }
}
