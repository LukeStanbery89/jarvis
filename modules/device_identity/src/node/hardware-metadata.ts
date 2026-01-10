import * as os from 'os';
import { IDeviceMetadata } from '../shared/types';
import { NetworkUtils } from './network-utils';

/**
 * Hardware Metadata Collector
 * Collects hardware-specific metadata for device identification
 */
export class HardwareMetadataCollector {
    static async collect(): Promise<Partial<IDeviceMetadata>> {
        return {
            hostname: os.hostname(),
            osVersion: this.getOsVersion(),
            architecture: os.arch(),
            macAddress: NetworkUtils.getFirstNonInternalMacAddress()
        };
    }

    private static getOsVersion(): string {
        return `${os.type()} ${os.release()}`;
    }
}
