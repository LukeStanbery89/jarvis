import { vi } from 'vitest';
import { OpenUrlTool } from '../src/OpenUrlTool';
import { ToolExecutionRequest } from '@jarvis/protocol';

describe('OpenUrlTool', () => {
    let tool: OpenUrlTool;

    beforeEach(() => {
        tool = new OpenUrlTool();
        jest.clearAllMocks();

        // Reset chrome.runtime.lastError
        chrome.runtime.lastError = undefined;

        // Reset Chrome API mocks to default successful behavior
        (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
            const tabs = [{ id: 1, url: 'https://example.com' }];
            callback?.(tabs);
            return Promise.resolve(tabs);
        });
        (chrome.tabs.create as jest.Mock).mockImplementation((createProps, callback) => {
            const newTab = { id: 2, url: createProps.url };
            callback?.(newTab);
            return Promise.resolve(newTab);
        });
        (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
            const updatedTab = { id: tabId, url: updateProps.url };
            callback?.(updatedTab);
            return Promise.resolve(updatedTab);
        });
        (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation(() => {});
        (chrome.tabs.onUpdated.removeListener as jest.Mock).mockImplementation(() => {});
    });

    describe('Basic functionality', () => {
        it('should have correct tool name', () => {
            expect(tool.toolName).toBe('open_url');
        });

        it('should provide tool definition', () => {
            const definition = OpenUrlTool.getToolDefinition();
            expect(definition.name).toBe('open_url');
            expect(definition.description).toBeTruthy();
            expect(definition.parameters).toBeDefined();
            expect(definition.parameters.properties.url).toBeDefined();
            expect(definition.parameters.properties.newTab).toBeDefined();
        });
    });

    describe('URL validation', () => {
        it('should validate and normalize URL without protocol', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'example.com' },
                timeout: 5000,
            };

            // Mock successful navigation
            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs = [{ id: 1 }];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                callback?.({ id: tabId, url: updateProps.url });
                return Promise.resolve({ id: tabId, url: updateProps.url });
            });

            // Mock the onUpdated listener to trigger completion
            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(1, { status: 'complete' }), 10);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.url).toBe('https://example.com');
        });

        it('should reject javascript: protocol URLs (invalid URL format)', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'javascript:alert("xss")' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Forbidden protocol: javascript:');
        });

        it('should reject data: protocol URLs (invalid URL format)', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'data:text/html,test' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Forbidden protocol: data:');
        });

        it('should reject file: protocol URLs (invalid URL format)', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'file:///etc/passwd' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Forbidden protocol: file:');
        });

        it('should accept https URLs', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 5000,
            };

            // Mock successful navigation
            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs = [{ id: 1 }];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                callback?.({ id: tabId });
                return Promise.resolve({ id: tabId });
            });

            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(1, { status: 'complete' }), 10);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
        });
    });

    describe('Navigation in current tab', () => {
        it('should navigate current tab to URL', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com', newTab: false },
                timeout: 5000,
            };

            const mockTab = { id: 1, url: 'https://old-url.com' };
            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs = [mockTab];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                callback?.({ id: tabId, url: updateProps.url });
                return Promise.resolve({ id: tabId, url: updateProps.url });
            });

            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(1, { status: 'complete' }), 10);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true }, expect.any(Function));
            expect(chrome.tabs.update).toHaveBeenCalledWith(1, { url: 'https://example.com' }, expect.any(Function));
        });

        it('should handle no active tab error', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 5000,
            };

            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs: any[] = [];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('browser_api');
        });
    });

    describe('Navigation in new tab', () => {
        it('should open URL in new tab', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com', newTab: true },
                timeout: 5000,
            };

            const mockNewTab = { id: 2, url: 'https://example.com' };
            (chrome.tabs.create as jest.Mock).mockImplementation((createProps, callback) => {
                callback?.(mockNewTab);
                return Promise.resolve(mockNewTab);
            });

            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(2, { status: 'complete' }), 10);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com' }, expect.any(Function));
        });

        it('should handle tab creation error', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com', newTab: true },
                timeout: 5000,
            };

            // Override the beforeEach mock to simulate an error
            (chrome.tabs.create as jest.Mock).mockImplementationOnce((createProps, callback) => {
                chrome.runtime.lastError = { message: 'Failed to create tab' };
                callback?.(null); // Call with null to trigger the error
                return Promise.resolve(null);
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('browser_api');
        });
    });

    describe('Parameter validation', () => {
        it('should require url parameter', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Missing required parameter: url');
        });
    });

    describe('Execution time tracking', () => {
        it('should track execution time', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 5000,
            };

            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs = [{ id: 1 }];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                callback?.({ id: tabId });
                return Promise.resolve({ id: tabId });
            });

            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(1, { status: 'complete' }), 10);
            });

            const response = await tool.execute(request);

            expect(response.executionTime).toBeGreaterThanOrEqual(0);
        });



        it('should send WebSocket status updates during navigation', async () => {
            const mockWsManager = {
                connected: true,
                sendMessage: jest.fn(),
                socket: null,
                isConnected: true,
                reconnectAttempts: 0,
                connectionTimeoutHandle: null,
                reconnectDelay: 1000,
                maxReconnectAttempts: 5,
                messageQueue: [],
                eventListeners: {},
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                connect: jest.fn(),
                disconnect: jest.fn(),
                reconnect: jest.fn(),
                send: jest.fn(),
            } as any;

            const toolWithWs = new OpenUrlTool(mockWsManager);

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 5000,
            };

            (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo, callback) => {
                const tabs = [{ id: 1 }];
                callback?.(tabs);
                return Promise.resolve(tabs);
            });
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                callback?.({ id: tabId });
                return Promise.resolve({ id: tabId });
            });

            (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
                setTimeout(() => listener(1, { status: 'complete' }), 10);
            });

            const response = await toolWithWs.execute(request);

            expect(response.success).toBe(true);
            expect(mockWsManager.sendMessage).toHaveBeenCalledWith('tool_execution_status', expect.objectContaining({
                status: 'executing',
                executionId: 'exec_123'
            }));
            expect(mockWsManager.sendMessage).toHaveBeenCalledWith('tool_execution_status', expect.objectContaining({
                status: 'completed',
                executionId: 'exec_123'
            }));
        });



        it('should handle malformed URLs', async () => {
            // Clear navigation mocks so we only test URL validation
            (chrome.tabs.query as jest.Mock).mockClear();
            (chrome.tabs.update as jest.Mock).mockClear();
            (chrome.tabs.create as jest.Mock).mockClear();
            (chrome.tabs.onUpdated.addListener as jest.Mock).mockClear();

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'http://invalid url with spaces' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Invalid URL format');
        });

        it('should validate URL parameter types', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 12345 }, // Invalid type but required parameter is present
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('browser_api'); // URL validation error
        });



        it('should handle empty URL parameter', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: '' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Invalid URL format');
        });

        it('should handle URL with only whitespace', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: '   ' },
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('Invalid URL format');
        });
    });
});
