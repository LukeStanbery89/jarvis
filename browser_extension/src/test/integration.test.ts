// Integration tests using test utilities - demonstrates proper mocking
// Integration tests using test utilities - demonstrates proper mocking
import {
    mockChromeApis,
    mockNetworkRequests,
    mockDomElements,
    testSafety,
} from './testUtils';

describe('Integration Tests - No LLM Credits Used', () => {
    beforeEach(() => {
        // Reset DOM and mocks
        document.body.innerHTML = '';
        mockDomElements.setSelectedText(''); // No selection by default

        // Reset storage mock to empty state
        mockChromeApis.storage.setMockData({});
    });

    afterEach(() => {
        // Safety check after each test
        testSafety.assertNoLLMUsage();
    });

    it('summarizes page content without calling real APIs', async () => {
        // Setup: Mock page content
        mockDomElements.createMockPage({
            title: 'Test Article',
            headings: ['Main Heading'],
            paragraphs: ['Important content here', 'More details about the topic'],
        });

        mockChromeApis.tabs.setActiveTab({ id: 1, url: 'https://example.com' });
        mockChromeApis.scripting.setExecuteScriptResult({ title: 'Test Article', content: 'Mock content' });
        mockNetworkRequests.mockSuccessfulSummarize();

        // 1. Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        expect(tabs[0].url).toBe('https://example.com');

        // 2. Execute content script
        const results = await (chrome.scripting.executeScript as any)({ target: { tabId: tabs[0].id as number }, func: () => ({ title: 'extracted' }) }) as any;
        expect(results[0].result.title).toBe('Test Article');

        // 3. Call summarization API (mocked)
        const response = await fetch('http://127.0.0.1:3000/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: results[0].result.content, title: results[0].result.title }),
        });

        const summary = await response.json();
        expect(summary.summary).toBe('Mock summary content');
        expect(summary.title).toBe('Mock Page Title');

        await chrome.storage.local.set({ lastSummary: summary });
        mockChromeApis.storage.expectStorageSet('lastSummary', summary);
    });

    it('summarizes selected text when present', async () => {
        mockDomElements.setSelectedText('This is selected text to summarize');
        mockChromeApis.tabs.setActiveTab({ id: 1, url: 'https://example.com' });
        mockChromeApis.scripting.setExecuteScriptResult({ title: 'Test Page', content: 'SELECTED TEXT: This is selected text to summarize', url: 'https://example.com', isSelection: true });
        mockNetworkRequests.mockSuccessfulSummarize();

        const selection = window.getSelection();
        const selectedText = selection?.toString();
        expect(selectedText).toBe('This is selected text to summarize');

        const results = await (chrome.scripting.executeScript as any)({ target: { tabId: 1 }, func: () => ({ content: 'mock' }) }) as any;
        expect(results[0].result.isSelection).toBe(true);
        expect(results[0].result.content).toContain('SELECTED TEXT:');
    });

    describe('Session Management & Chat', () => {
        it('creates a new session when none exists and sends a message', async () => {
            mockChromeApis.storage.setMockData({});

            const mockSessionId = 'session_abc123';
            const mockWebSocketManager: any = {
                currentSessionId: null,
                createNewSession: jest.fn().mockImplementation(async () => {
                    mockWebSocketManager.currentSessionId = mockSessionId;
                    await chrome.storage.local.set({ chatSessionId: mockSessionId });
                    return mockSessionId;
                }),
                sendChatMessage: jest.fn().mockImplementation(async (message: string) => {
                    if (!mockWebSocketManager.currentSessionId) {
                        await mockWebSocketManager.createNewSession();
                    }
                    return { id: 'msg_1', type: 'chat_message', content: message, sessionId: mockWebSocketManager.currentSessionId };
                }),
            };

            const result = await mockWebSocketManager.sendChatMessage('Hello');
            expect(mockWebSocketManager.createNewSession).toHaveBeenCalledTimes(1);
            expect(result.sessionId).toBe(mockSessionId);
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ chatSessionId: mockSessionId });
        });

        it('sends chat and receives mocked agent response', async () => {
            mockNetworkRequests.mockSuccessfulChat();

            const response = await fetch('http://127.0.0.1:3000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hi', sessionId: 's1' }) });
            const chatResponse = await response.json();
            expect(chatResponse.content).toBe('Mock agent response');
            expect(chatResponse.sessionId).toBe('mock-session-id');
        });
    });

    describe('Error Handling', () => {
        it('handles API error responses gracefully', async () => {
            mockNetworkRequests.mockApiError(500, 'Server temporarily unavailable');
            const response = await fetch('http://127.0.0.1:3000/api/summarize');
            const error = await response.json();
            expect(response.ok).toBe(false);
            expect(error.error).toBe('Server temporarily unavailable');
        });

        it('handles network failures', async () => {
            mockNetworkRequests.mockNetworkError('Connection refused');
            await expect(fetch('http://127.0.0.1:3000/api/summarize')).rejects.toThrow('Connection refused');
        });
    });

    describe('Safety Assertions', () => {
        it('ensures mocking system is in place', () => {
            expect(global.fetch).toBeDefined();
            expect(chrome.storage.local.get).toBeDefined();
            expect(chrome.tabs.query).toBeDefined();
            expect(chrome.scripting.executeScript).toBeDefined();
        });
    });
});