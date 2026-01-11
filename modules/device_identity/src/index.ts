/**
 * Main exports for @jarvis/device-identity
 * Exports only shared types and interfaces for platform-agnostic code
 *
 * For platform-specific implementations, use:
 * - '@jarvis/device-identity/browser' for browser environments
 * - '@jarvis/device-identity/node' for Node.js environments
 */

export * from './shared/types';
export { DeviceIdentity } from './shared/device-identity';
export { UUIDValidator } from './shared/uuid-validator';
