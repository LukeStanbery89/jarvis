import { BaseToolExecutor } from './BaseToolExecutor';
import { ToolExecutionRequest, ToolExecutionResponse } from '@jarvis/protocol';
import { logger } from './utils/logger';

/**
 * Tool for opening URLs in the current tab or new tab
 *
 * Capabilities:
 * - Navigate current tab to specified URL
 * - Open URL in new tab (optional)
 * - Validate URL format and security
 * - Handle navigation errors and timeouts
 */

export interface OpenUrlParams {
    url: string;
    newTab?: boolean;
}

export interface OpenUrlResult {
    success: boolean;
    url: string;
    message: string;
}

export class OpenUrlTool extends BaseToolExecutor {
    readonly toolName = 'open_url';

    async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
        logger.verbose('Executing URL navigation', {
            service: 'OpenUrlTool',
            executionId: request.executionId,
            parameters: Object.keys(request.parameters)
        });

        const startTime = Date.now();

        try {
            // Validate parameters
            this.validateParameters(request.parameters, ['url']);
            const params = request.parameters as unknown as OpenUrlParams;

            // Send status update
            await this.sendStatusUpdate(request, 'executing', 0, 'Navigating to URL...');

            // Validate URL format
            this.validateUrl(params.url);

            // Normalize URL (add protocol if missing)
            const normalizedUrl = this.normalizeUrl(params.url);
            const normalizedParams = { ...params, url: normalizedUrl };

            // Navigate to URL
            await this.sendStatusUpdate(request, 'executing', 50, `Navigating...`);
            const result = await this.navigateToUrl(normalizedParams, request);

            const executionTime = Date.now() - startTime;

            logger.info('URL navigation completed', {
                service: 'OpenUrlTool',
                executionId: request.executionId,
                url: params.url,
                newTab: params.newTab || false,
                success: result.success,
                executionTime
            });

            if (result.success) {
                // Send completion status
                await this.sendStatusUpdate(request, 'completed', 100, result.message);
                return this.createSuccessResponse(request, result, executionTime);
            } else {
                // Send failure status
                await this.sendStatusUpdate(request, 'failed', 100, result.message);
                return this.createErrorResponse(
                    request,
                    'browser_api',
                    result.message,
                    true, // Navigation failures are usually recoverable
                    executionTime
                );
            }

        } catch (error) {
            const executionTime = Date.now() - startTime;

            logger.error('URL navigation failed', {
                service: 'OpenUrlTool',
                executionId: request.executionId,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime
            });

            return this.createErrorResponse(
                request,
                'browser_api',
                `Failed to open URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true, // Navigation failures are usually recoverable
                executionTime
            );
        }
    }

    /**
     * Validate URL format and security
     */
    private validateUrl(url: string): void {
        // Check for dangerous protocols in the original URL first
        const dangerousProtocols = ['javascript:', 'data:', 'file:'];
        for (const protocol of dangerousProtocols) {
            if (url.toLowerCase().startsWith(protocol)) {
                throw new Error(`Forbidden protocol: ${protocol}`);
            }
        }

        let urlToValidate = url;

        // Add https:// if no protocol is specified
        if (!url.match(/^https?:\/\//)) {
            urlToValidate = `https://${url}`;
        }

        try {
            const urlObj = new URL(urlToValidate);

            // Ensure it's http or https
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error(`Unsupported protocol: ${urlObj.protocol}`);
            }

        } catch (error) {
            if (error instanceof Error && error.name === 'TypeError') {
                throw new Error('Invalid URL format');
            }
            throw error;
        }
    }

    /**
     * Normalize URL by adding protocol if missing
     */
    private normalizeUrl(url: string): string {
        if (!url.match(/^https?:\/\//)) {
            return `https://${url}`;
        }
        return url;
    }

    /**
     * Navigate to the specified URL
     */
    private async navigateToUrl(params: OpenUrlParams, request?: ToolExecutionRequest): Promise<OpenUrlResult> {
        try {
            if (params.newTab) {
                // Open in new tab using Chrome API
                await this.openInNewTab(params.url);
                return {
                    success: true,
                    url: params.url,
                    message: `Successfully opened ${params.url} in new tab`
                };
            } else {
                // Navigate current active tab using Chrome API
                await this.navigateCurrentTab(params.url, request);
                return {
                    success: true,
                    url: params.url,
                    message: `Successfully navigated to ${params.url}`
                };
            }
        } catch (error) {
            return {
                success: false,
                url: params.url,
                message: `Failed to navigate to ${params.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Navigate current active tab to URL using Chrome extension API
     */
    private async navigateCurrentTab(url: string, request?: ToolExecutionRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Navigation timeout: page did not load within 30 seconds`));
            }, 30000); // 30 second timeout

            try {
                // Get the active tab first
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (chrome.runtime.lastError) {
                        clearTimeout(timeout);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!tabs || tabs.length === 0) {
                        clearTimeout(timeout);
                        reject(new Error('No active tab found'));
                        return;
                    }

                    const activeTab = tabs[0];
                    const tabId = activeTab.id!;

                    // Set up listener for tab updates BEFORE initiating navigation
                    const updateListener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
                        if (updatedTabId === tabId) {
                            if (changeInfo.status === 'loading' && request) {
                                // Page started loading
                                this.sendStatusUpdate(request, 'executing', 75, 'Loading...').catch(() => { });
                            } else if (changeInfo.status === 'complete') {
                                // Page has finished loading
                                chrome.tabs.onUpdated.removeListener(updateListener);
                                clearTimeout(timeout);
                                resolve();
                            }
                        }
                    };

                    chrome.tabs.onUpdated.addListener(updateListener);

                    // Navigate the active tab to the new URL
                    chrome.tabs.update(tabId, { url }, (tab) => {
                        if (chrome.runtime.lastError) {
                            chrome.tabs.onUpdated.removeListener(updateListener);
                            clearTimeout(timeout);
                            reject(new Error(chrome.runtime.lastError.message));
                        }
                        // Don't resolve here - wait for the onUpdated listener to fire
                    });
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Chrome API error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    /**
     * Open URL in new tab using Chrome extension API
     */
    private async openInNewTab(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`New tab timeout: page did not load within 30 seconds`));
            }, 30000); // 30 second timeout

            try {
                chrome.tabs.create({ url }, (newTab) => {
                    if (chrome.runtime.lastError) {
                        clearTimeout(timeout);
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }

                    if (!newTab || !newTab.id) {
                        clearTimeout(timeout);
                        reject(new Error('Failed to create new tab'));
                        return;
                    }

                    const tabId = newTab.id;

                    // Set up listener for tab updates
                    const updateListener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
                        if (updatedTabId === tabId && changeInfo.status === 'complete') {
                            // Page has finished loading
                            chrome.tabs.onUpdated.removeListener(updateListener);
                            clearTimeout(timeout);
                            resolve();
                        }
                    };

                    chrome.tabs.onUpdated.addListener(updateListener);
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(new Error(`Chrome API error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    /**
     * Get tool definition for server registration
     */
    static getToolDefinition() {
        return {
            name: 'open_url',
            description: 'Navigate to a URL in the current tab or open in a new tab. When user says "open in new tab", "new tab", "new window", or similar phrases, set newTab=true. Otherwise navigate current tab.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The URL to navigate to',
                        pattern: '^https?://.+'
                    },
                    newTab: {
                        type: 'boolean',
                        description: 'IMPORTANT: Set to true ONLY when user explicitly mentions "new tab", "new window", "open in new tab", or similar phrases. Default is false for current tab navigation.'
                    }
                },
                required: ['url']
            }
        };
    }
}
