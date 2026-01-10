import * as os from 'os';

/**
 * Network Utilities
 * Provides network-related helper functions for device identification
 */
export class NetworkUtils {
    /**
     * Gets the first non-internal MAC address from network interfaces
     *
     * Iterates through all network interfaces and returns the MAC address
     * of the first non-internal interface (excluding localhost).
     *
     * @returns MAC address string, or 'unknown' if no valid interface found
     *
     * @example
     * const mac = NetworkUtils.getFirstNonInternalMacAddress();
     * console.log(mac); // 'aa:bb:cc:dd:ee:ff' or 'unknown'
     */
    static getFirstNonInternalMacAddress(): string {
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            const iface = interfaces[name];
            if (!iface) continue;

            for (const addr of iface) {
                // Skip internal interfaces (localhost) and null MAC addresses
                if (!addr.internal && addr.mac !== '00:00:00:00:00:00') {
                    return addr.mac;
                }
            }
        }

        // Return consistent fallback value
        return 'unknown';
    }
}
