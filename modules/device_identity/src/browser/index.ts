/**
 * Browser-specific exports for @jarvis/device-identity
 * Import from '@jarvis/device-identity/browser' in browser environments
 */

// Re-export shared types and classes
export * from '../shared/types';
export { DeviceIdentity } from '../shared/device-identity';

// Browser-specific implementations
export { BrowserIdGenerator } from './browser-id-generator';
export { BrowserStorageAdapter } from './browser-storage';
export { BrowserMetadataCollector } from './browser-metadata';
