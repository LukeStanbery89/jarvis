import { createHomeAssistantGetDevices } from '../../../../tools/home_assistant/HomeAssistantGetDevices';
import { IHomeAssistantService, IHAEntityState } from '../../../../tools/home_assistant/interfaces/IHomeAssistantServices';

describe('HomeAssistantGetDevices', () => {
    let mockService: jest.Mocked<IHomeAssistantService>;
    
    beforeEach(() => {
        mockService = {
            getControllableDevices: jest.fn(),
            controlDeviceWithValidation: jest.fn(),
            clearDeviceCache: jest.fn(),
            getCacheStats: jest.fn()
        };
    });

    it('should create tool with correct name and description', () => {
        const tool = createHomeAssistantGetDevices(mockService);
        
        expect(tool.name).toBe('home_assistant_get_devices');
        expect(tool.description).toBe('List controllable Home Assistant devices with entity_id, state, and friendly_name. Use when user asks about available devices or before controlling a device.');
    });

    it('should return formatted device list when devices are available', async () => {
        const mockDevices: IHAEntityState[] = [
            {
                entity_id: 'switch.living_room_lamp',
                state: 'on',
                friendly_name: 'Living Room Lamp'
            },
            {
                entity_id: 'light.bedroom_light',
                state: 'off',
                friendly_name: 'Bedroom Light'
            }
        ];

        mockService.getControllableDevices.mockResolvedValue(mockDevices);
        
        const tool = createHomeAssistantGetDevices(mockService);
        const result = await tool.func('');

        expect(result).toBe(
            'Found 2 controllable Home Assistant devices:\n\n' +
            '- Living Room Lamp (switch.living_room_lamp): currently on\n' +
            '- Bedroom Light (light.bedroom_light): currently off'
        );
        
        expect(mockService.getControllableDevices).toHaveBeenCalledTimes(1);
    });

    it('should return no devices message when list is empty', async () => {
        mockService.getControllableDevices.mockResolvedValue([]);
        
        const tool = createHomeAssistantGetDevices(mockService);
        const result = await tool.func('');

        expect(result).toBe('No controllable devices found in Home Assistant.');
        expect(mockService.getControllableDevices).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
        const errorMessage = 'Connection failed';
        mockService.getControllableDevices.mockRejectedValue(new Error(errorMessage));
        
        const tool = createHomeAssistantGetDevices(mockService);
        const result = await tool.func('');

        expect(result).toBe(`Failed to get Home Assistant devices: ${errorMessage}`);
        expect(mockService.getControllableDevices).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions', async () => {
        mockService.getControllableDevices.mockRejectedValue('String error');
        
        const tool = createHomeAssistantGetDevices(mockService);
        const result = await tool.func('');

        expect(result).toBe('Failed to get Home Assistant devices: Unknown error');
        expect(mockService.getControllableDevices).toHaveBeenCalledTimes(1);
    });

    it('should format single device correctly', async () => {
        const mockDevices: IHAEntityState[] = [
            {
                entity_id: 'switch.test_device',
                state: 'unknown',
                friendly_name: 'Test Device'
            }
        ];

        mockService.getControllableDevices.mockResolvedValue(mockDevices);
        
        const tool = createHomeAssistantGetDevices(mockService);
        const result = await tool.func('');

        expect(result).toBe(
            'Found 1 controllable Home Assistant devices:\n\n' +
            '- Test Device (switch.test_device): currently unknown'
        );
    });
});