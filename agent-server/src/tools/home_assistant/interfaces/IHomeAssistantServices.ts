/**
 * Type definitions and interfaces for Home Assistant services
 */

export type HomeAssistantAction = 'turn_on' | 'turn_off' | 'toggle';

export interface HttpResponse {
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<any>;
}

/**
 * Extended HTTP client interface that includes both GET and POST methods
 */
export interface IHomeAssistantHttpClient {
    get(url: string, options?: { headers?: Record<string, string>; }): Promise<HttpResponse>;
    post(url: string, body: any, options?: { headers?: Record<string, string>; }): Promise<HttpResponse>;
}

export interface IHAEntityState {
    entity_id: string;
    state: string;
    friendly_name: string;
    attributes?: {
        friendly_name?: string;
        [key: string]: any;
    };
}

export interface IHomeAssistantConfig {
    serverUrl: string;
    apiToken: string;
    entityPrefixWhitelist: string[];
}

export interface ControlResult {
    success: boolean;
    friendlyName: string;
    error?: string;
}

export interface CacheStats {
    lastDeviceListShown: Date | null;
    recentDeviceCount: number;
    suppressionActive: boolean;
}

/**
 * Interface for Home Assistant service operations
 */
export interface IHomeAssistantService {
    /**
     * Get list of controllable Home Assistant devices
     * Results are memoized to reduce API calls
     */
    getControllableDevices(): Promise<IHAEntityState[]>;

    /**
     * Control a Home Assistant device with validation and friendly name lookup
     * @param entityId - The entity ID of the device
     * @param action - The action to perform
     * @returns Object with control result and device info
     */
    controlDeviceWithValidation(entityId: string, action: HomeAssistantAction): Promise<ControlResult>;

    /**
     * Clear the device cache to force fresh data on next request
     */
    clearDeviceCache(): void;

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): any;
}