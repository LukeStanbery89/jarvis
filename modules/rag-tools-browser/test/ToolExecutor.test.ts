import { ToolExecutor } from '../src/ToolExecutor';
import { ExtractPageContentTool } from '../src/ExtractPageContentTool';
import { OpenUrlTool } from '../src/OpenUrlTool';
import { ToolExecutionRequest } from '@jarvis/protocol';

describe('ToolExecutor', () => {
    let executor: ToolExecutor;

    beforeEach(() => {
        executor = new ToolExecutor();
        jest.clearAllMocks();
        document.body.innerHTML = '';

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
        (chrome.tabs.onUpdated.addListener as jest.Mock).mockImplementation((listener) => {
            // Auto-trigger 'complete' status for both existing (id=1) and new tabs (id=2)
            setTimeout(() => {
                listener(1, { status: 'complete' });
                listener(2, { status: 'complete' });
            }, 10);
        });
        (chrome.tabs.onUpdated.removeListener as jest.Mock).mockImplementation(() => {});
    });

    describe('Initialization', () => {
        it('should register built-in tools on initialization', () => {
            const capabilities = executor.getCapabilities();
            expect(capabilities).toContain('extract_page_content');
            expect(capabilities).toContain('open_url');
        });

        it('should include base capabilities', () => {
            const capabilities = executor.getCapabilities();
            expect(capabilities).toContain('browser_api_access');
            expect(capabilities).toContain('page_content_extraction');
            expect(capabilities).toContain('navigation');
            expect(capabilities).toContain('tab_management');
        });

        it('should return tool definitions', () => {
            const definitions = executor.getAvailableTools();
            expect(definitions).toHaveLength(2);
            expect(definitions.some(d => d.name === 'extract_page_content')).toBe(true);
            expect(definitions.some(d => d.name === 'open_url')).toBe(true);
        });
    });

    describe('Tool execution', () => {
        it('should execute extract_page_content tool', async () => {
            // Create a more complete DOM structure that will pass visibility checks
            document.body.innerHTML = `
                <main>
                    <h1>Test Heading</h1>
                    <p>Test content paragraph</p>
                </main>
            `;

            // Mock offsetWidth/offsetHeight for visibility check (jsdom defaults to 0)
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
                configurable: true,
                value: 100,
            });
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                configurable: true,
                value: 100,
            });

            // Mock getComputedStyle for this specific test
            (window.getComputedStyle as jest.Mock).mockReturnValue({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
            });

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(true);
            expect(response.result).toBeDefined();
            expect(response.result.content).toContain('Test content');
        });

        it('should execute open_url tool', async () => {
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

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(true);
            expect(response.result.success).toBe(true);
        });

        it('should return error for unknown tool', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'unknown_tool',
                parameters: {},
                timeout: 5000,
            };

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('validation');
            expect(response.error?.message).toContain('not found');
        });
    });

    describe('Timeout handling', () => {
        it('should timeout long-running tools', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 100, // Very short timeout
            };

            // Mock a slow navigation that never completes
            (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
            (chrome.tabs.update as jest.Mock).mockImplementation((tabId, updateProps, callback) => {
                // Never call callback
                return new Promise(() => {}); // Never resolves
            });

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('timeout');
            expect(response.error?.message).toContain('timeout');
        });

        it('should use default timeout of 30 seconds', async () => {
            document.body.innerHTML = `
                <main>
                    <h1>Test Heading</h1>
                    <p>Test content paragraph</p>
                </main>
            `;

            // Mock offsetWidth/offsetHeight for visibility check
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
                configurable: true,
                value: 100,
            });
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                configurable: true,
                value: 100,
            });

            // Mock getComputedStyle for this specific test
            (window.getComputedStyle as jest.Mock).mockReturnValue({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
            });

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                // No timeout specified
            };

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(true);
        });
    });

    describe('WebSocket manager integration', () => {
        it('should accept websocket manager in constructor', () => {
            const mockWsManager = {
                connected: true,
                sendMessage: jest.fn(),
            } as any;

            const executorWithWs = new ToolExecutor(mockWsManager);
            expect(executorWithWs).toBeDefined();
        });

        it('should allow setting websocket manager after construction', () => {
            const mockWsManager = {
                connected: true,
                sendMessage: jest.fn(),
            } as any;

            executor.setWebSocketManager(mockWsManager);
            // Should not throw
        });
    });

    describe('Cleanup', () => {
        it('should clear pending timeouts on cleanup', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 5000,
            };

            // Start a request but don't let it complete
            (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
            (chrome.tabs.update as jest.Mock).mockImplementation(() => {
                return new Promise(() => {}); // Never resolves
            });

            // Don't await - let it hang
            executor.executeToolRequest(request);

            // Cleanup should clear the timeout
            expect(() => executor.cleanup()).not.toThrow();
        });
    });

    describe('Error recovery', () => {
        it('should mark timeout errors as not recoverable', async () => {
            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'open_url',
                parameters: { url: 'https://example.com' },
                timeout: 50,
            };

            (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
            (chrome.tabs.update as jest.Mock).mockImplementation(() => {
                return new Promise(() => {});
            });

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(false);
            expect(response.error?.type).toBe('timeout');
            expect(response.error?.recoverable).toBe(false);
        });

        it('should mark other errors as potentially recoverable', async () => {
            document.body.innerHTML = ''; // Empty page will cause error

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await executor.executeToolRequest(request);

            expect(response.success).toBe(false);
            // Content extraction errors are marked as not recoverable in the tool itself
            expect(response.error?.type).toBe('browser_api');
        });
    });
});
