/**
 * Device type enumeration
 * Specific device types instead of generic "hardware"
 */
export type DeviceType = 'browser_extension' | 'raspberry_pi' | 'cli';

/**
 * Device identity interface
 * Represents a persistent device with unique ID, type, capabilities, and metadata
 */
export interface IDeviceIdentity {
    deviceId: string;              // Persistent device identifier (UUID)
    deviceType: DeviceType;        // Device type
    capabilities: string[];        // Device capabilities
    metadata: IDeviceMetadata;     // Device-specific metadata
}

/**
 * Device metadata interface
 * Contains device information with optional fields for different device types
 */
export interface IDeviceMetadata {
    // Common fields
    createdAt: number;             // First registration timestamp
    lastSeenAt: number;            // Last active timestamp

    // Browser-specific fields
    browserName?: string;          // 'chrome', 'firefox', 'safari', 'edge'
    browserVersion?: string;       // e.g., '120.0.0.0'
    extensionVersion?: string;     // Extension version from manifest
    userAgent?: string;            // Full user agent string

    // Hardware-specific fields (Raspberry Pi)
    hostname?: string;             // Device hostname
    macAddress?: string;           // Network MAC address
    cpuSerial?: string;            // RPi CPU serial number
    osVersion?: string;            // OS version string
    architecture?: string;         // 'armv7l', 'aarch64', etc.
}

/**
 * Storage adapter interface
 * Abstracts storage operations for different environments (browser, node, etc.)
 */
export interface IStorageAdapter {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
}

/**
 * Device ID generator interface
 * Handles device ID generation and validation
 */
export interface IDeviceIdGenerator {
    generateDeviceId(): Promise<string>;
    validateDeviceId(deviceId: string): boolean;
}
