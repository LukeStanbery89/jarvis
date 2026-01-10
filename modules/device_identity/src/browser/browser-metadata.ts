import { IDeviceMetadata } from '../shared/types';

/**
 * Browser Metadata Collector
 * Collects browser-specific metadata for device identification
 */
export class BrowserMetadataCollector {
    static async collect(): Promise<Partial<IDeviceMetadata>> {
        return {
            browserName: this.getBrowserName(),
            browserVersion: this.getBrowserVersion(),
            extensionVersion: chrome.runtime.getManifest().version,
            userAgent: navigator.userAgent
        };
    }

    private static getBrowserName(): string {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) return 'chrome';
        if (userAgent.includes('Firefox')) return 'firefox';
        if (userAgent.includes('Safari')) return 'safari';
        if (userAgent.includes('Edge')) return 'edge';
        return 'unknown';
    }

    private static getBrowserVersion(): string {
        const userAgent = navigator.userAgent;
        const versionMatch = userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/(\d+\.\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : 'unknown';
    }
}
