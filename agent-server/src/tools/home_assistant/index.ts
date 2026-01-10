import dotenv from "dotenv";
import { createHomeAssistantGetDevices } from './HomeAssistantGetDevices';
import { createHomeAssistantControlDevice } from './HomeAssistantControlDevice';
import { HomeAssistantService, IHomeAssistantConfig } from './services';
import { FetchHttpClient } from '../shared';

dotenv.config();

/**
 * Home Assistant configuration from environment variables
 */
const homeAssistantConfig: IHomeAssistantConfig = {
    serverUrl: process.env.HOME_ASSISTANT_URL || 'http://192.168.86.25:8123',
    apiToken: process.env.HOME_ASSISTANT_ACCESS_TOKEN || '',
    entityPrefixWhitelist: ['switch'] // Configured directly in code
};

// Validate configuration
if (!homeAssistantConfig.apiToken) {
    console.warn('HOME_ASSISTANT_ACCESS_TOKEN not configured - Home Assistant tools will not work');
}

/**
 * Create Home Assistant service instance with dependency injection
 */
const createHomeAssistantService = (): HomeAssistantService => {
    const httpClient = new FetchHttpClient();
    return new HomeAssistantService(httpClient, homeAssistantConfig);
};

/**
 * Home Assistant tools for LangChain/LangGraph agents
 * 
 * Provides two tools:
 * 1. HomeAssistantGetDevices - List available controllable devices
 * 2. HomeAssistantControlDevice - Control specific devices (on/off/toggle)
 */
const homeAssistantService = createHomeAssistantService();
export const homeAssistantGetDevices = createHomeAssistantGetDevices(homeAssistantService);
export const homeAssistantControlDevice = createHomeAssistantControlDevice(homeAssistantService);

// Export as array for easy inclusion in agent tools
export default [
    homeAssistantGetDevices,
    homeAssistantControlDevice
];

// Export configuration and services for testing
export { homeAssistantConfig };
export * from './services';
export * from './interfaces';