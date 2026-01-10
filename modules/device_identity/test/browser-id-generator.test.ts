import { BrowserIdGenerator } from '../src/browser/browser-id-generator';

// Mock crypto.randomUUID
const mockCrypto = {
    randomUUID: jest.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
    getRandomValues: jest.fn((array: Uint8Array) => {
        // Fill with deterministic values for testing
        for (let i = 0; i < array.length; i++) {
            array[i] = i;
        }
        return array;
    })
};

global.crypto = mockCrypto as any;

describe('BrowserIdGenerator', () => {
    let generator: BrowserIdGenerator;

    beforeEach(() => {
        jest.clearAllMocks();
        generator = new BrowserIdGenerator();
    });

    describe('generateDeviceId', () => {
        it('should generate a valid UUID using crypto.randomUUID', async () => {
            const deviceId = await generator.generateDeviceId();

            expect(deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(mockCrypto.randomUUID).toHaveBeenCalled();
        });

        it('should generate a valid UUID format', async () => {
            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
        });

        it('should use fallback if crypto.randomUUID is not available', async () => {
            // Temporarily remove randomUUID
            const originalRandomUUID = mockCrypto.randomUUID;
            delete (mockCrypto as any).randomUUID;

            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
            expect(mockCrypto.getRandomValues).toHaveBeenCalled();

            // Restore randomUUID
            mockCrypto.randomUUID = originalRandomUUID;
        });

        it('should generate different UUIDs on multiple calls', async () => {
            mockCrypto.randomUUID
                .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440000')
                .mockReturnValueOnce('6ba7b810-9dad-11d1-80b4-00c04fd430c8');

            const deviceId1 = await generator.generateDeviceId();
            const deviceId2 = await generator.generateDeviceId();

            expect(deviceId1).not.toBe(deviceId2);
        });
    });

    describe('validateDeviceId', () => {
        it('should validate a correct UUID v4', () => {
            const validUUID = '550e8400-e29b-41d4-a716-446655440000';
            expect(generator.validateDeviceId(validUUID)).toBe(true);
        });

        it('should reject invalid UUID formats', () => {
            const invalidUUIDs = [
                '',
                'not-a-uuid',
                '550e8400-e29b-41d4-a716',  // Too short
                '550e8400-e29b-41d4-a716-446655440000-extra',  // Too long
                '550e8400e29b41d4a716446655440000',  // Missing dashes
                'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  // Non-hex characters
            ];

            invalidUUIDs.forEach(uuid => {
                expect(generator.validateDeviceId(uuid)).toBe(false);
            });
        });

        it('should validate UUIDs with uppercase letters', () => {
            const validUUID = '550E8400-E29B-41D4-A716-446655440000';
            expect(generator.validateDeviceId(validUUID)).toBe(true);
        });

        it('should validate UUIDs with different variant bits', () => {
            const uuids = [
                '550e8400-e29b-41d4-8716-446655440000',  // Variant 10xx
                '550e8400-e29b-41d4-9716-446655440000',  // Variant 10xx
                '550e8400-e29b-41d4-a716-446655440000',  // Variant 10xx
                '550e8400-e29b-41d4-b716-446655440000'   // Variant 10xx
            ];

            uuids.forEach(uuid => {
                expect(generator.validateDeviceId(uuid)).toBe(true);
            });
        });
    });
});
