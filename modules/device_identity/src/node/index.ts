/**
 * Node-specific exports for @jarvis/device-identity
 * Import from '@jarvis/device-identity/node' in Node.js environments
 */

// Re-export shared types and classes
export * from '../shared/types';
export { DeviceIdentity } from '../shared/device-identity';

// Node-specific implementations
export { HardwareIdGenerator } from './hardware-id-generator';
export { NodeStorageAdapter } from './node-storage';
export { HardwareMetadataCollector } from './hardware-metadata';
