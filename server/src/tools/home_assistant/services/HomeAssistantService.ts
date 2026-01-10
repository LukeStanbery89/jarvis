import { logger } from '../../../utils/logger';
import { FetchHttpClient } from '../../shared';
import { memoize, Memoization } from '../../../utils/Memoization';
import { 
    IHomeAssistantService, 
    IHAEntityState, 
    IHomeAssistantConfig, 
    HomeAssistantAction, 
    ControlResult,
    IHomeAssistantHttpClient
} from '../interfaces';

/**
 * Home Assistant API service for device control and state management
 * 
 * Provides methods to:
 * - Get available controllable devices
 * - Control devices (turn on/off, toggle)
 * - Filter devices by whitelisted entity types
 */
export class HomeAssistantService implements IHomeAssistantService {
    private httpClient: IHomeAssistantHttpClient;
    private config: IHomeAssistantConfig;

    constructor(httpClient: IHomeAssistantHttpClient, config: IHomeAssistantConfig) {
        this.httpClient = httpClient;
        this.config = config;

        // Create memoized version of getControllableDevices with proper context binding
        this.getControllableDevices = memoize(
            this.getControllableDevicesImpl.bind(this), 
            { 
                ttl: 30000, // 30 seconds
                debug: process.env.VERBOSE_LOGGING === 'true' 
            },
            'HomeAssistantService.getControllableDevices'
        );

        logger.info('HomeAssistantService initialized', {
            service: 'HomeAssistantService',
            serverUrl: config.serverUrl,
            whitelistedTypes: config.entityPrefixWhitelist
        });
    }

    /**
     * Gets the list of Home Assistant devices that can be controlled
     * Returns devices with entity_id, state, and friendly_name
     * 
     * This method is memoized with a 30-second TTL to reduce API calls and token usage
     * Note: This is assigned in the constructor to the memoized implementation
     */
    async getControllableDevices(): Promise<IHAEntityState[]> {
        // This will be replaced by the memoized version in constructor
        throw new Error('getControllableDevices should be replaced by memoized version');
    }

    /**
     * Internal implementation of getControllableDevices (before memoization)
     */
    private async getControllableDevicesImpl(): Promise<IHAEntityState[]> {
        logger.debug('Fetching Home Assistant device states', {
            service: 'HomeAssistantService',
            endpoint: `${this.config.serverUrl}/api/states`
        });

        const httpOptions = {
            headers: {
                "Authorization": `Bearer ${this.config.apiToken}`,
                "Content-Type": "application/json",
            }
        };

        try {
            const resp = await this.httpClient.get(`${this.config.serverUrl}/api/states`, httpOptions);

            if (!resp.ok) {
                throw new Error(`Error getting Home Assistant states: ${resp.statusText}`);
            }

            const states: IHAEntityState[] = await resp.json();
            logger.debug('Retrieved device states from Home Assistant', {
                service: 'HomeAssistantService',
                totalDevices: states.length
            });

            // Filter and format devices
            const controllableDevices = states
                .map(state => ({
                    entity_id: state.entity_id,
                    state: state.state,
                    friendly_name: state?.attributes?.friendly_name || state.entity_id
                }))
                .filter(device => {
                    // Only return whitelisted entity types
                    const typePrefix = device.entity_id.split(".")[0];
                    const whitelistedType = this.config.entityPrefixWhitelist.includes(typePrefix);

                    // Omit LED entities (device indicator lights)
                    const isLED = device.entity_id.endsWith("_led");

                    return whitelistedType && !isLED;
                });

            logger.info('Filtered controllable Home Assistant devices', {
                service: 'HomeAssistantService',
                controllableDevices: controllableDevices.length,
                totalDevices: states.length
            });

            return controllableDevices;

        } catch (error) {
            logger.error('Failed to fetch Home Assistant device states', {
                service: 'HomeAssistantService',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Control a Home Assistant device with validation and friendly name lookup in a single operation
     * 
     * @param entityId - The entity ID of the device (e.g., "switch.living_room_lamp")
     * @param action - The action to perform ("turn_on", "turn_off", "toggle")
     * @returns Object with control result and device info
     */
    async controlDeviceWithValidation(entityId: string, action: HomeAssistantAction): Promise<ControlResult> {
        try {
            // Single API call to get all devices
            const devices = await this.getControllableDevices();
            
            // Validate entity exists
            const device = devices.find(d => d.entity_id === entityId);
            if (!device) {
                return {
                    success: false,
                    friendlyName: entityId,
                    error: `Entity ID "${entityId}" not found or not controllable`
                };
            }

            // Perform the control action
            await this.controlDevice(entityId, action);

            return {
                success: true,
                friendlyName: device.friendly_name
            };

        } catch (error) {
            logger.error('Failed to control Home Assistant device with validation', {
                service: 'HomeAssistantService',
                entityId,
                action,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            return {
                success: false,
                friendlyName: entityId,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Control a Home Assistant device (internal method)
     * 
     * @param entityId - The entity ID of the device (e.g., "switch.living_room_lamp")
     * @param action - The action to perform ("turn_on", "turn_off", "toggle")
     */
    private async controlDevice(entityId: string, action: HomeAssistantAction): Promise<Record<string, any>> {
        const domain = entityId.split(".")[0];
        const endpoint = `/api/services/${domain}/${action}`;
        const payload = { entity_id: entityId };

        logger.info('Controlling Home Assistant device', {
            service: 'HomeAssistantService',
            entityId,
            action,
            domain,
            endpoint
        });

        const httpOptions = {
            headers: {
                "Authorization": `Bearer ${this.config.apiToken}`,
                "Content-Type": "application/json",
            }
        };

        const resp = await this.httpClient.post(`${this.config.serverUrl}${endpoint}`, payload, httpOptions);

        if (!resp.ok) {
            throw new Error(`Error controlling Home Assistant device: ${resp.statusText}`);
        }

        const result = await resp.json();

        logger.info('Successfully controlled Home Assistant device', {
            service: 'HomeAssistantService',
            entityId,
            action,
            success: true
        });

        return result;
    }

    /**
     * Clear the device cache to force fresh data on next request
     * Useful after device configuration changes
     */
    clearDeviceCache(): void {
        Memoization.clearCache('HomeAssistantService.getControllableDevices');
        logger.debug('Home Assistant device cache cleared', {
            service: 'HomeAssistantService'
        });
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): any {
        return Memoization.getCacheStats('HomeAssistantService.getControllableDevices');
    }
}