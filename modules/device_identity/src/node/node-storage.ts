import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IStorageAdapter } from '../shared/types';

/**
 * Node Storage Adapter
 * Uses file system storage in ~/.jarvis/ directory for persistent storage
 */
export class NodeStorageAdapter implements IStorageAdapter {
    private readonly storageDir: string;

    constructor(storageDir?: string) {
        // Default to ~/.jarvis/ directory
        this.storageDir = storageDir ?? path.join(os.homedir(), '.jarvis');
    }

    async get(key: string): Promise<string | null> {
        try {
            const filePath = this.getFilePath(key);
            const data = await fs.readFile(filePath, 'utf8');
            return data;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null; // File doesn't exist
            }
            throw error;
        }
    }

    async set(key: string, value: string): Promise<void> {
        await this.ensureStorageDir();
        const filePath = this.getFilePath(key);
        await fs.writeFile(filePath, value, 'utf8');
    }

    async remove(key: string): Promise<void> {
        try {
            const filePath = this.getFilePath(key);
            await fs.unlink(filePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async has(key: string): Promise<boolean> {
        const value = await this.get(key);
        return value !== null;
    }

    private getFilePath(key: string): string {
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.storageDir, `${safeKey}.txt`);
    }

    private async ensureStorageDir(): Promise<void> {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            // Ignore if directory already exists
        }
    }
}
