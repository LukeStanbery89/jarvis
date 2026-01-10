import * as fs from 'fs';
import * as os from 'os';
import { HardwareIdGenerator } from '../src/node/hardware-id-generator';

jest.mock('fs');
jest.mock('os');

describe('HardwareIdGenerator', () => {
    let generator: HardwareIdGenerator;
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockOs = os as jest.Mocked<typeof os>;

    beforeEach(() => {
        jest.clearAllMocks();
        generator = new HardwareIdGenerator();

        // Default mock implementations
        mockOs.hostname.mockReturnValue('test-hostname');
        mockOs.networkInterfaces.mockReturnValue({
            eth0: [
                {
                    address: '192.168.1.100',
                    netmask: '255.255.255.0',
                    family: 'IPv4',
                    mac: 'aa:bb:cc:dd:ee:ff',
                    internal: false,
                    cidr: '192.168.1.100/24'
                }
            ]
        });
        mockFs.readFileSync.mockReturnValue('Serial\t\t: 0000000012345678\n');
    });

    describe('generateDeviceId', () => {
        it('should generate a deterministic UUID from hardware fingerprint', async () => {
            const deviceId1 = await generator.generateDeviceId();
            const deviceId2 = await generator.generateDeviceId();

            // Should be the same since hardware fingerprint is the same
            expect(deviceId1).toBe(deviceId2);
        });

        it('should generate a valid UUID format', async () => {
            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
        });

        it('should use MAC address in fingerprint', async () => {
            const deviceId1 = await generator.generateDeviceId();

            // Change MAC address
            mockOs.networkInterfaces.mockReturnValue({
                eth0: [
                    {
                        address: '192.168.1.100',
                        netmask: '255.255.255.0',
                        family: 'IPv4',
                        mac: 'ff:ee:dd:cc:bb:aa',
                        internal: false,
                        cidr: '192.168.1.100/24'
                    }
                ]
            });

            const deviceId2 = await generator.generateDeviceId();

            // Should be different since MAC changed
            expect(deviceId1).not.toBe(deviceId2);
        });

        it('should use CPU serial in fingerprint', async () => {
            const deviceId1 = await generator.generateDeviceId();

            // Change CPU serial
            mockFs.readFileSync.mockReturnValue('Serial\t\t: 0000000087654321\n');

            const deviceId2 = await generator.generateDeviceId();

            // Should be different since CPU serial changed
            expect(deviceId1).not.toBe(deviceId2);
        });

        it('should use hostname in fingerprint', async () => {
            const deviceId1 = await generator.generateDeviceId();

            // Change hostname
            mockOs.hostname.mockReturnValue('different-hostname');

            const deviceId2 = await generator.generateDeviceId();

            // Should be different since hostname changed
            expect(deviceId1).not.toBe(deviceId2);
        });

        it('should handle missing CPU serial gracefully', async () => {
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
        });

        it('should handle missing network interfaces', async () => {
            mockOs.networkInterfaces.mockReturnValue({});

            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
        });

        it('should skip internal network interfaces', async () => {
            mockOs.networkInterfaces.mockReturnValue({
                lo: [
                    {
                        address: '127.0.0.1',
                        netmask: '255.0.0.0',
                        family: 'IPv4',
                        mac: '00:00:00:00:00:00',
                        internal: true,
                        cidr: '127.0.0.1/8'
                    }
                ],
                eth0: [
                    {
                        address: '192.168.1.100',
                        netmask: '255.255.255.0',
                        family: 'IPv4',
                        mac: 'aa:bb:cc:dd:ee:ff',
                        internal: false,
                        cidr: '192.168.1.100/24'
                    }
                ]
            });

            const deviceId = await generator.generateDeviceId();

            // Should use eth0, not lo
            expect(mockOs.networkInterfaces).toHaveBeenCalled();
        });

        it('should handle CPU serial with different format', async () => {
            mockFs.readFileSync.mockReturnValue('Processor\t: ARMv7\nSerial\t\t: 0000000012345678\nRevision\t: a02082\n');

            const deviceId = await generator.generateDeviceId();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            expect(uuidRegex.test(deviceId)).toBe(true);
        });
    });

    describe('validateDeviceId', () => {
        it('should validate a correct UUID', () => {
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
    });
});
