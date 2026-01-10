import { IDeviceIdentity, DeviceType, IDeviceMetadata, IStorageAdapter, IDeviceIdGenerator } from './types';

/**
 * DeviceIdentity class
 * Manages device identity including persistent device ID, metadata, and storage
 */
export class DeviceIdentity {
    private static readonly DEVICE_ID_KEY = 'device_id';
    private static readonly METADATA_KEY = 'device_metadata';

    private deviceId?: string;
    private metadata?: IDeviceMetadata;

    constructor(
        private readonly deviceType: DeviceType,
        private readonly storage: IStorageAdapter,
        private readonly idGenerator: IDeviceIdGenerator,
        private readonly capabilities: string[]
    ) {}

    /**
     * Initialize device identity - load from storage or create new
     */
    async initialize(): Promise<IDeviceIdentity> {
        // Try to load existing device ID
        const storedId = await this.storage.get(DeviceIdentity.DEVICE_ID_KEY);
        const storedMetadata = await this.storage.get(DeviceIdentity.METADATA_KEY);

        if (storedId && this.idGenerator.validateDeviceId(storedId)) {
            // Use existing device ID
            this.deviceId = storedId;
            if (storedMetadata) {
                try {
                    this.metadata = JSON.parse(storedMetadata) as IDeviceMetadata;
                    this.metadata.lastSeenAt = Date.now();
                } catch (error) {
                    // Handle corrupted metadata by creating default
                    this.metadata = this.createDefaultMetadata();
                }
            } else {
                this.metadata = this.createDefaultMetadata();
            }
        } else {
            // Generate new device ID
            this.deviceId = await this.idGenerator.generateDeviceId();
            this.metadata = this.createDefaultMetadata();
        }

        // Save to storage
        await this.save();

        return this.getIdentity();
    }

    /**
     * Get current device identity
     */
    getIdentity(): IDeviceIdentity {
        if (!this.deviceId || !this.metadata) {
            throw new Error('DeviceIdentity not initialized. Call initialize() first.');
        }

        return {
            deviceId: this.deviceId,
            deviceType: this.deviceType,
            capabilities: this.capabilities,
            metadata: this.metadata
        };
    }

    /**
     * Update device metadata
     */
    async updateMetadata(updates: Partial<IDeviceMetadata>): Promise<void> {
        if (!this.metadata) {
            throw new Error('DeviceIdentity not initialized. Call initialize() first.');
        }

        this.metadata = {
            ...this.metadata,
            ...updates,
            lastSeenAt: Date.now()
        };

        await this.save();
    }

    /**
     * Reset device identity (generate new device ID)
     */
    async reset(): Promise<IDeviceIdentity> {
        await this.storage.remove(DeviceIdentity.DEVICE_ID_KEY);
        await this.storage.remove(DeviceIdentity.METADATA_KEY);

        this.deviceId = undefined;
        this.metadata = undefined;

        return this.initialize();
    }

    private async save(): Promise<void> {
        if (!this.deviceId || !this.metadata) {
            throw new Error('Cannot save uninitialized device identity');
        }

        await this.storage.set(DeviceIdentity.DEVICE_ID_KEY, this.deviceId);
        await this.storage.set(DeviceIdentity.METADATA_KEY, JSON.stringify(this.metadata));
    }

    private createDefaultMetadata(): IDeviceMetadata {
        const now = Date.now();
        return {
            createdAt: now,
            lastSeenAt: now
        };
    }
}
