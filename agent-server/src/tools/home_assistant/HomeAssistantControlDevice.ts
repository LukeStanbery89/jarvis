import { DynamicTool } from '@langchain/core/tools';
import { logger } from '../../utils/logger';
import { IHomeAssistantService, HomeAssistantAction } from './services';

/**
 * LangChain tool for controlling Home Assistant devices
 */
export const createHomeAssistantControlDevice = (homeAssistantService: IHomeAssistantService): DynamicTool => {
    
    logger.debug('HomeAssistantControlDevice tool initialized', {
        tool: 'HomeAssistantControlDevice'
    });

    return new DynamicTool({
        name: "home_assistant_control_device",
        description: `Control Home Assistant device. Input: JSON with entity_id (exact ID from device list) and action ("turn_on", "turn_off", "toggle"). Get entity_id from home_assistant_get_devices first.`,
        func: async (input: string) => {
            try {
                const parsed = JSON.parse(input);
                return controlDevice(homeAssistantService, parsed.entity_id, parsed.action);
            } catch (error) {
                return `Invalid input format. Please provide a JSON string like: {"entity_id": "switch.lamp", "action": "turn_on"}`;
            }
        }
    });
};

async function controlDevice(homeAssistantService: IHomeAssistantService, entityId: string, action: HomeAssistantAction): Promise<string> {
    logger.info('Controlling Home Assistant device via tool', {
        tool: 'HomeAssistantControlDevice',
        entityId,
        action
    });

    // Single optimized call that validates, controls, and gets friendly name
    const result = await homeAssistantService.controlDeviceWithValidation(entityId, action);

    if (!result.success) {
        const errorMessage = result.error || `Entity ID "${entityId}" not found or not controllable. Use home_assistant_get_devices to see available devices.`;
        logger.warn('Failed to control Home Assistant device', {
            tool: 'HomeAssistantControlDevice',
            entityId,
            action,
            error: result.error
        });
        return errorMessage;
    }

    const actionPastTense = action === 'turn_on' ? 'turned on' : 
                           action === 'turn_off' ? 'turned off' : 'toggled';

    const successMessage = `Successfully ${actionPastTense} ${result.friendlyName} (${entityId}).`;

    logger.info('Successfully controlled Home Assistant device', {
        tool: 'HomeAssistantControlDevice',
        entityId,
        action,
        friendlyName: result.friendlyName
    });

    return successMessage;
}