import { IDeviceIdGenerator } from '../shared/types';
import { UUIDValidator } from '../shared/uuid-validator';

/**
 * Browser ID Generator
 * Uses Web Crypto API to generate cryptographically secure UUIDs
 */
export class BrowserIdGenerator implements IDeviceIdGenerator {
    async generateDeviceId(): Promise<string> {
        // Use Web Crypto API for secure random UUID
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        // Fallback for older browsers (rare but defensive)
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return this.bytesToUUID(array);
    }

    validateDeviceId(deviceId: string): boolean {
        return UUIDValidator.validate(deviceId);
    }

    private bytesToUUID(bytes: Uint8Array): string {
        // Set version (4) and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

        const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
}
