import { createHomeAssistantControlDevice } from '../../../src/home_assistant/HomeAssistantControlDevice';
import { IHomeAssistantService, ControlResult, HomeAssistantAction } from '../../../src/home_assistant/interfaces/IHomeAssistantServices';

describe('HomeAssistantControlDevice', () => {
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
        const tool = createHomeAssistantControlDevice(mockService);

        expect(tool.name).toBe('home_assistant_control_device');
        expect(tool.description).toBe('Control Home Assistant device. Input: JSON with entity_id (exact ID from device list) and action ("turn_on", "turn_off", "toggle"). Get entity_id from home_assistant_get_devices first.');
    });

    it('should successfully control device with turn_on action', async () => {
        const mockResult: ControlResult = {
            success: true,
            friendlyName: 'Living Room Lamp'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.living_room_lamp', action: 'turn_on' });
        const result = await tool.func(input);

        expect(result).toBe('Successfully turned on Living Room Lamp (switch.living_room_lamp).');
        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledWith('switch.living_room_lamp', 'turn_on');
    });

    it('should successfully control device with turn_off action', async () => {
        const mockResult: ControlResult = {
            success: true,
            friendlyName: 'Bedroom Light'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'light.bedroom_light', action: 'turn_off' });
        const result = await tool.func(input);

        expect(result).toBe('Successfully turned off Bedroom Light (light.bedroom_light).');
        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledWith('light.bedroom_light', 'turn_off');
    });

    it('should successfully control device with toggle action', async () => {
        const mockResult: ControlResult = {
            success: true,
            friendlyName: 'Office Switch'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.office_switch', action: 'toggle' });
        const result = await tool.func(input);

        expect(result).toBe('Successfully toggled Office Switch (switch.office_switch).');
        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledWith('switch.office_switch', 'toggle');
    });

    it('should handle device not found error', async () => {
        const mockResult: ControlResult = {
            success: false,
            friendlyName: 'switch.non_existent',
            error: 'Entity ID "switch.non_existent" not found or not controllable'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.non_existent', action: 'turn_on' });
        const result = await tool.func(input);

        expect(result).toBe('Entity ID "switch.non_existent" not found or not controllable');
        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledWith('switch.non_existent', 'turn_on');
    });

    it('should handle control failure with custom error message', async () => {
        const mockResult: ControlResult = {
            success: false,
            friendlyName: 'Living Room Lamp',
            error: 'Device is offline'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.living_room_lamp', action: 'turn_on' });
        const result = await tool.func(input);

        expect(result).toBe('Device is offline');
    });

    it('should handle control failure without custom error message', async () => {
        const mockResult: ControlResult = {
            success: false,
            friendlyName: 'Living Room Lamp'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.living_room_lamp', action: 'turn_on' });
        const result = await tool.func(input);

        expect(result).toBe('Entity ID "switch.living_room_lamp" not found or not controllable. Use home_assistant_get_devices to see available devices.');
    });

    it('should handle invalid JSON input', async () => {
        const tool = createHomeAssistantControlDevice(mockService);
        const result = await tool.func('invalid json');

        expect(result).toBe('Invalid input format. Please provide a JSON string like: {"entity_id": "switch.lamp", "action": "turn_on"}');
        expect(mockService.controlDeviceWithValidation).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON with missing fields', async () => {
        const mockResult: ControlResult = {
            success: false,
            friendlyName: 'switch.lamp',
            error: 'Invalid action'
        };
        mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

        const tool = createHomeAssistantControlDevice(mockService);
        const input = JSON.stringify({ entity_id: 'switch.lamp' });

        const result = await tool.func(input);

        expect(result).toBe('Invalid action');
        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledWith('switch.lamp', undefined);
    });

    it('should test all action past tense mappings', async () => {
        const actions: { action: HomeAssistantAction; pastTense: string; }[] = [
            { action: 'turn_on', pastTense: 'turned on' },
            { action: 'turn_off', pastTense: 'turned off' },
            { action: 'toggle', pastTense: 'toggled' }
        ];

        const tool = createHomeAssistantControlDevice(mockService);

        for (const { action, pastTense } of actions) {
            const mockResult: ControlResult = {
                success: true,
                friendlyName: 'Test Device'
            };
            mockService.controlDeviceWithValidation.mockResolvedValue(mockResult);

            const input = JSON.stringify({ entity_id: 'switch.test', action });
            const result = await tool.func(input);

            expect(result).toBe(`Successfully ${pastTense} Test Device (switch.test).`);
        }

        expect(mockService.controlDeviceWithValidation).toHaveBeenCalledTimes(3);
    });
});
