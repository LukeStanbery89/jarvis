// Test utilities for browser tools
import { ToolExecutionRequest } from '@jarvis/protocol';

export function createTestRequest(overrides: Partial<ToolExecutionRequest> = {}): ToolExecutionRequest {
    return {
        id: 'test_msg_123',
        type: 'tool_execution_request',
        timestamp: Date.now(),
        executionId: 'test_exec_123',
        toolName: 'test_tool',
        parameters: {},
        timeout: 5000,
        securityContext: {
            allowedOrigins: ['https://example.com'],
            permissions: ['browser_access'],
            parameterValidation: {}
        },
        ...overrides
    };
}

export function mockChromeTabs() {
    const mockTabs = {
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        onUpdated: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    };

    // Setup default successful behavior
    mockTabs.query.mockImplementation((queryInfo, callback) => {
        const tabs = [{ id: 1, url: 'https://example.com' }];
        callback?.(tabs);
        return Promise.resolve(tabs);
    });

    mockTabs.create.mockImplementation((createProps, callback) => {
        const newTab = { id: 2, url: createProps.url };
        callback?.(newTab);
        return Promise.resolve(newTab);
    });

    mockTabs.update.mockImplementation((tabId, updateProps, callback) => {
        const updatedTab = { id: tabId, url: updateProps.url };
        callback?.(updatedTab);
        return Promise.resolve(updatedTab);
    });

    mockTabs.onUpdated.addListener.mockImplementation((listener) => {
        setTimeout(() => {
            listener(1, { status: 'complete' });
            listener(2, { status: 'complete' });
        }, 10);
    });

    mockTabs.onUpdated.removeListener.mockImplementation(() => {});

    return mockTabs;
}

export function mockWebSocketManager() {
    return {
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
    };
}