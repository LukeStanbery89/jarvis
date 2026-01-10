import { DeviceIdentity } from '../src/shared/device-identity';
import { IStorageAdapter, IDeviceIdGenerator, IDeviceMetadata } from '../src/shared/types';

// Mock storage adapter
class MockStorageAdapter implements IStorageAdapter {
    private storage = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.storage.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.storage.delete(key);
    }

    async has(key: string): Promise<boolean> {
        return this.storage.has(key);
    }

    clear(): void {
        this.storage.clear();
    }
}

// Mock ID generator
class MockIdGenerator implements IDeviceIdGenerator {
    private counter = 0;

    async generateDeviceId(): Promise<string> {
        this.counter++;
        return `mock-device-id-${this.counter}`;
    }

    validateDeviceId(deviceId: string): boolean {
        return deviceId.startsWith('mock-device-id-');
    }
}

describe('DeviceIdentity', () => {
    let storage: MockStorageAdapter;
    let idGenerator: MockIdGenerator;
    let deviceIdentity: DeviceIdentity;

    beforeEach(() => {
        storage = new MockStorageAdapter();
        idGenerator = new MockIdGenerator();
        deviceIdentity = new DeviceIdentity(
            'browser_extension',
            storage,
            idGenerator,
            ['page_extraction', 'navigation']
        );
    });

    describe('initialize', () => {
        it('should generate new device ID on first initialization', async () => {
            const identity = await deviceIdentity.initialize();

            expect(identity.deviceId).toBe('mock-device-id-1');
            expect(identity.deviceType).toBe('browser_extension');
            expect(identity.capabilities).toEqual(['page_extraction', 'navigation']);
            expect(identity.metadata.createdAt).toBeDefined();
            expect(identity.metadata.lastSeenAt).toBeDefined();
        });

        it('should load existing device ID from storage', async () => {
            // Initialize once
            const identity1 = await deviceIdentity.initialize();
            const deviceId1 = identity1.deviceId;

            // Create new instance with same storage
            const deviceIdentity2 = new DeviceIdentity(
                'browser_extension',
                storage,
                idGenerator,
                ['page_extraction', 'navigation']
            );

            // Initialize again
            const identity2 = await deviceIdentity2.initialize();

            expect(identity2.deviceId).toBe(deviceId1);
            expect(identity2.deviceType).toBe('browser_extension');
        });

        it('should update lastSeenAt on subsequent initializations', async () => {
            const identity1 = await deviceIdentity.initialize();
            const lastSeenAt1 = identity1.metadata.lastSeenAt;

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 10));

            // Create new instance with same storage
            const deviceIdentity2 = new DeviceIdentity(
                'browser_extension',
                storage,
                idGenerator,
                ['page_extraction', 'navigation']
            );

            const identity2 = await deviceIdentity2.initialize();
            const lastSeenAt2 = identity2.metadata.lastSeenAt;

            expect(lastSeenAt2).toBeGreaterThan(lastSeenAt1);
        });

        it('should preserve createdAt on subsequent initializations', async () => {
            const identity1 = await deviceIdentity.initialize();
            const createdAt1 = identity1.metadata.createdAt;

            // Create new instance with same storage
            const deviceIdentity2 = new DeviceIdentity(
                'browser_extension',
                storage,
                idGenerator,
                ['page_extraction', 'navigation']
            );

            const identity2 = await deviceIdentity2.initialize();
            const createdAt2 = identity2.metadata.createdAt;

            expect(createdAt2).toBe(createdAt1);
        });

        it('should generate new ID if stored ID is invalid', async () => {
            // Store invalid device ID
            await storage.set('device_id', 'invalid-device-id');

            const identity = await deviceIdentity.initialize();

            expect(identity.deviceId).toBe('mock-device-id-1');
            expect(idGenerator.validateDeviceId(identity.deviceId)).toBe(true);
        });

        it('should save device ID and metadata to storage', async () => {
            await deviceIdentity.initialize();

            const storedId = await storage.get('device_id');
            const storedMetadata = await storage.get('device_metadata');

            expect(storedId).toBeDefined();
            expect(storedMetadata).toBeDefined();
            expect(JSON.parse(storedMetadata!)).toHaveProperty('createdAt');
            expect(JSON.parse(storedMetadata!)).toHaveProperty('lastSeenAt');
        });
    });

    describe('getIdentity', () => {
        it('should return current identity after initialization', async () => {
            await deviceIdentity.initialize();
            const identity = deviceIdentity.getIdentity();

            expect(identity.deviceId).toBeDefined();
            expect(identity.deviceType).toBe('browser_extension');
            expect(identity.capabilities).toEqual(['page_extraction', 'navigation']);
            expect(identity.metadata).toBeDefined();
        });

        it('should throw error if called before initialization', () => {
            expect(() => deviceIdentity.getIdentity()).toThrow('DeviceIdentity not initialized');
        });
    });

    describe('updateMetadata', () => {
        it('should update metadata fields', async () => {
            await deviceIdentity.initialize();

            await deviceIdentity.updateMetadata({
                browserName: 'chrome',
                browserVersion: '120.0.0.0'
            });

            const identity = deviceIdentity.getIdentity();

            expect(identity.metadata.browserName).toBe('chrome');
            expect(identity.metadata.browserVersion).toBe('120.0.0.0');
        });

        it('should update lastSeenAt when updating metadata', async () => {
            await deviceIdentity.initialize();
            const lastSeenAt1 = deviceIdentity.getIdentity().metadata.lastSeenAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            await deviceIdentity.updateMetadata({ browserName: 'chrome' });
            const lastSeenAt2 = deviceIdentity.getIdentity().metadata.lastSeenAt;

            expect(lastSeenAt2).toBeGreaterThan(lastSeenAt1);
        });

        it('should preserve existing metadata fields', async () => {
            await deviceIdentity.initialize();
            const createdAt = deviceIdentity.getIdentity().metadata.createdAt;

            await deviceIdentity.updateMetadata({ browserName: 'chrome' });

            const identity = deviceIdentity.getIdentity();

            expect(identity.metadata.createdAt).toBe(createdAt);
            expect(identity.metadata.browserName).toBe('chrome');
        });

        it('should persist metadata updates to storage', async () => {
            await deviceIdentity.initialize();

            await deviceIdentity.updateMetadata({
                browserName: 'chrome',
                browserVersion: '120.0.0.0'
            });

            const storedMetadata = await storage.get('device_metadata');
            const metadata = JSON.parse(storedMetadata!) as IDeviceMetadata;

            expect(metadata.browserName).toBe('chrome');
            expect(metadata.browserVersion).toBe('120.0.0.0');
        });

        it('should throw error if called before initialization', async () => {
            await expect(deviceIdentity.updateMetadata({ browserName: 'chrome' }))
                .rejects.toThrow('DeviceIdentity not initialized');
        });
    });

    describe('reset', () => {
        it('should generate new device ID', async () => {
            const identity1 = await deviceIdentity.initialize();
            const deviceId1 = identity1.deviceId;

            const identity2 = await deviceIdentity.reset();
            const deviceId2 = identity2.deviceId;

            expect(deviceId2).not.toBe(deviceId1);
            expect(deviceId2).toBe('mock-device-id-2');
        });

        it('should clear existing device ID from storage', async () => {
            await deviceIdentity.initialize();

            expect(await storage.has('device_id')).toBe(true);

            await deviceIdentity.reset();

            // Device ID should be replaced with new one
            const storedId = await storage.get('device_id');
            expect(storedId).toBe('mock-device-id-2');
        });

        it('should create new metadata with new timestamps', async () => {
            const identity1 = await deviceIdentity.initialize();
            const createdAt1 = identity1.metadata.createdAt;

            await new Promise(resolve => setTimeout(resolve, 10));

            const identity2 = await deviceIdentity.reset();
            const createdAt2 = identity2.metadata.createdAt;

            expect(createdAt2).toBeGreaterThan(createdAt1);
        });

        it('should preserve device type and capabilities', async () => {
            await deviceIdentity.initialize();

            const identity = await deviceIdentity.reset();

            expect(identity.deviceType).toBe('browser_extension');
            expect(identity.capabilities).toEqual(['page_extraction', 'navigation']);
        });
    });

    describe('edge cases', () => {
        it('should handle corrupted metadata in storage', async () => {
            await storage.set('device_id', 'mock-device-id-1');
            await storage.set('device_metadata', 'invalid-json{');

            // Should not throw, should create default metadata
            const identity = await deviceIdentity.initialize();

            expect(identity.metadata.createdAt).toBeDefined();
            expect(identity.metadata.lastSeenAt).toBeDefined();
        });

        it('should handle multiple capabilities', async () => {
            const deviceIdentity = new DeviceIdentity(
                'raspberry_pi',
                storage,
                idGenerator,
                ['camera', 'microphone', 'speaker', 'gpio']
            );

            const identity = await deviceIdentity.initialize();

            expect(identity.capabilities).toEqual(['camera', 'microphone', 'speaker', 'gpio']);
        });

        it('should handle empty capabilities', async () => {
            const deviceIdentity = new DeviceIdentity(
                'cli',
                storage,
                idGenerator,
                []
            );

            const identity = await deviceIdentity.initialize();

            expect(identity.capabilities).toEqual([]);
        });
    });
});
