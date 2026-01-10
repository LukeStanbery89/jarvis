import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { IDeviceIdGenerator } from '../shared/types';
import { UUIDValidator } from '../shared/uuid-validator';
import { NetworkUtils } from './network-utils';

/**
 * Hardware ID Generator
 * Generates deterministic device IDs based on hardware fingerprint (MAC + CPU serial)
 * Primarily designed for Raspberry Pi but works on any Linux system
 */
export class HardwareIdGenerator implements IDeviceIdGenerator {
    async generateDeviceId(): Promise<string> {
        // Gather hardware identifiers
        const macAddress = NetworkUtils.getFirstNonInternalMacAddress();
        const cpuSerial = await this.getCpuSerial();
        const hostname = os.hostname();

        // Create deterministic device ID from hardware fingerprint
        const fingerprint = `${macAddress}:${cpuSerial}:${hostname}`;
        const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');

        // Convert to UUID format for consistency with browser IDs
        return this.hashToUUID(hash);
    }

    validateDeviceId(deviceId: string): boolean {
        return UUIDValidator.validate(deviceId);
    }

    private async getCpuSerial(): Promise<string> {
        // RPi-specific: read CPU serial from /proc/cpuinfo
        try {
            const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
            const serialMatch = cpuinfo.match(/^Serial\s*:\s*(\w+)$/m);
            return serialMatch ? serialMatch[1] : 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    private hashToUUID(hash: string): string {
        // Convert SHA-256 hash to UUID format (first 32 hex chars)
        return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    }
}
