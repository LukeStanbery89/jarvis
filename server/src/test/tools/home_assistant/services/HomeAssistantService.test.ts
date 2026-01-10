import { HomeAssistantService } from '../../../../tools/home_assistant/services/HomeAssistantService';
import { 
    IHomeAssistantHttpClient, 
    IHomeAssistantConfig, 
    HomeAssistantAction,
    HttpResponse 
} from '../../../../tools/home_assistant/interfaces/IHomeAssistantServices';

describe('HomeAssistantService', () => {
    let mockHttpClient: jest.Mocked<IHomeAssistantHttpClient>;
    let mockConfig: IHomeAssistantConfig;
    let service: HomeAssistantService;

    beforeAll(() => {
        mockHttpClient = {
            get: jest.fn(),
            post: jest.fn()
        };

        mockConfig = {
            serverUrl: 'http://127.0.0.1:8123',
            apiToken: 'test-token',
            entityPrefixWhitelist: ['switch', 'light']
        };

        service = new HomeAssistantService(mockHttpClient, mockConfig);
    });

    beforeEach(() => {
        // Clear only mock call history, not implementations
        mockHttpClient.get.mockClear();
        mockHttpClient.post.mockClear();
        service.clearDeviceCache();
    });

    describe('getControllableDevices', () => {
        const mockStates = [
            {
                entity_id: 'switch.living_room_lamp',
                state: 'on',
                attributes: { friendly_name: 'Living Room Lamp' }
            },
            {
                entity_id: 'light.bedroom_light',
                state: 'off',
                attributes: { friendly_name: 'Bedroom Light' }
            },
            {
                entity_id: 'sensor.temperature',
                state: '22.5',
                attributes: { friendly_name: 'Temperature Sensor' }
            },
            {
                entity_id: 'switch.office_led',
                state: 'on',
                attributes: { friendly_name: 'Office LED' }
            }
        ];

        it('should return filtered controllable devices', async () => {
            service.clearDeviceCache();
            const mockResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockStates)
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const devices = await service.getControllableDevices();

            expect(devices).toHaveLength(2);
            expect(devices[0]).toEqual({
                entity_id: 'switch.living_room_lamp',
                state: 'on',
                friendly_name: 'Living Room Lamp'
            });
            expect(devices[1]).toEqual({
                entity_id: 'light.bedroom_light',
                state: 'off',
                friendly_name: 'Bedroom Light'
            });
        });

        it('should filter out LED entities', async () => {
            service.clearDeviceCache();
            const mockResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockStates)
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const devices = await service.getControllableDevices();

            expect(devices.find(d => d.entity_id === 'switch.office_led')).toBeUndefined();
        });

        it('should filter out non-whitelisted entity types', async () => {
            service.clearDeviceCache();
            const mockResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockStates)
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const devices = await service.getControllableDevices();

            expect(devices.find(d => d.entity_id === 'sensor.temperature')).toBeUndefined();
        });

        it('should use entity_id as friendly_name when attributes.friendly_name is missing', async () => {
            // Clear cache to ensure fresh data
            service.clearDeviceCache();
            
            const mockStatesWithoutFriendlyName = [
                {
                    entity_id: 'switch.test_device',
                    state: 'on',
                    attributes: {}
                }
            ];

            const mockResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(mockStatesWithoutFriendlyName)
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            const devices = await service.getControllableDevices();

            expect(devices[0].friendly_name).toBe('switch.test_device');
        });

        it('should throw error when API request fails', async () => {
            service.clearDeviceCache();
            const mockResponse: HttpResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: jest.fn()
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            await expect(service.getControllableDevices()).rejects.toThrow('Error getting Home Assistant states: Unauthorized');
        });

        it('should throw error when HTTP client throws', async () => {
            service.clearDeviceCache();
            mockHttpClient.get.mockRejectedValue(new Error('Network error'));

            await expect(service.getControllableDevices()).rejects.toThrow('Network error');
        });

        it('should call correct endpoint with proper headers', async () => {
            service.clearDeviceCache();
            const mockResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue([])
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            await service.getControllableDevices();

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://127.0.0.1:8123/api/states',
                {
                    headers: {
                        'Authorization': 'Bearer test-token',
                        'Content-Type': 'application/json'
                    }
                }
            );
        });
    });

    describe('controlDeviceWithValidation', () => {
        const mockDevices = [
            {
                entity_id: 'switch.living_room_lamp',
                state: 'on',
                friendly_name: 'Living Room Lamp'
            }
        ];

        beforeEach(() => {
            // Mock getControllableDevices to return test devices
            jest.spyOn(service, 'getControllableDevices').mockResolvedValue(mockDevices);
        });

        it('should successfully control existing device', async () => {
            const mockControlResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue({})
            };
            mockHttpClient.post.mockResolvedValue(mockControlResponse);

            const result = await service.controlDeviceWithValidation('switch.living_room_lamp', 'turn_off');

            expect(result).toEqual({
                success: true,
                friendlyName: 'Living Room Lamp'
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'http://127.0.0.1:8123/api/services/switch/turn_off',
                { entity_id: 'switch.living_room_lamp' },
                {
                    headers: {
                        'Authorization': 'Bearer test-token',
                        'Content-Type': 'application/json'
                    }
                }
            );
        });

        it('should return error for non-existent device', async () => {
            const result = await service.controlDeviceWithValidation('switch.non_existent', 'turn_on');

            expect(result).toEqual({
                success: false,
                friendlyName: 'switch.non_existent',
                error: 'Entity ID "switch.non_existent" not found or not controllable'
            });

            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });

        it('should return error when control request fails', async () => {
            const mockControlResponse: HttpResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: jest.fn()
            };
            mockHttpClient.post.mockResolvedValue(mockControlResponse);

            const result = await service.controlDeviceWithValidation('switch.living_room_lamp', 'turn_on');

            expect(result).toEqual({
                success: false,
                friendlyName: 'switch.living_room_lamp',
                error: 'Error controlling Home Assistant device: Not Found'
            });
        });

        it('should handle HTTP client errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Connection refused'));

            const result = await service.controlDeviceWithValidation('switch.living_room_lamp', 'toggle');

            expect(result).toEqual({
                success: false,
                friendlyName: 'switch.living_room_lamp',
                error: 'Connection refused'
            });
        });

        it('should test all supported actions', async () => {
            const mockControlResponse: HttpResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue({})
            };
            mockHttpClient.post.mockResolvedValue(mockControlResponse);

            const actions: HomeAssistantAction[] = ['turn_on', 'turn_off', 'toggle'];
            
            for (const action of actions) {
                await service.controlDeviceWithValidation('switch.living_room_lamp', action);
                
                expect(mockHttpClient.post).toHaveBeenCalledWith(
                    `http://127.0.0.1:8123/api/services/switch/${action}`,
                    { entity_id: 'switch.living_room_lamp' },
                    expect.any(Object)
                );
            }

            expect(mockHttpClient.post).toHaveBeenCalledTimes(3);
        });
    });

    describe('clearDeviceCache', () => {
        it('should clear the device cache', () => {
            // This is a simple method that calls Memoization.clearCache
            // We can test that it doesn't throw an error
            expect(() => service.clearDeviceCache()).not.toThrow();
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', () => {
            const stats = service.getCacheStats();
            // Since we're using memoization, this should return an object or null
            expect(typeof stats === 'object').toBe(true);
        });
    });
});