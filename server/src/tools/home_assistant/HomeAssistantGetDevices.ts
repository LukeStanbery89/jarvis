import { DynamicTool } from '@langchain/core/tools';
import { logger } from '../../utils/logger';
import { IHomeAssistantConfig, IHomeAssistantService } from './services';

/**
 * LangChain tool for getting Home Assistant controllable devices
 */
export const createHomeAssistantGetDevices = (homeAssistantService: IHomeAssistantService): DynamicTool => {
    
    logger.debug('HomeAssistantGetDevices tool initialized', {
        tool: 'HomeAssistantGetDevices'
    });

    return new DynamicTool({
        name: "home_assistant_get_devices",
        description: `List controllable Home Assistant devices with entity_id, state, and friendly_name. Use when user asks about available devices or before controlling a device.`,
        func: async () => {
            return getDevices(homeAssistantService);
        }
    });
};

async function getDevices(homeAssistantService: IHomeAssistantService): Promise<string> {
    try {
        logger.info('Getting Home Assistant devices via tool', {
            tool: 'HomeAssistantGetDevices'
        });

        const devices = await homeAssistantService.getControllableDevices();
        
        if (devices.length === 0) {
            return "No controllable devices found in Home Assistant.";
        }

        // Format devices for the agent
        const deviceList = devices.map(device => {
            return `- ${device.friendly_name} (${device.entity_id}): currently ${device.state}`;
        }).join('\n');

        const result = `Found ${devices.length} controllable Home Assistant devices:\n\n${deviceList}`;

        logger.info('Successfully retrieved Home Assistant devices', {
            tool: 'HomeAssistantGetDevices',
            deviceCount: devices.length
        });

        return result;

    } catch (error) {
        const errorMessage = `Failed to get Home Assistant devices: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        logger.error('HomeAssistantGetDevices tool failed', {
            tool: 'HomeAssistantGetDevices',
            error: error instanceof Error ? error.message : 'Unknown error'
        });

        return errorMessage;
    }
}