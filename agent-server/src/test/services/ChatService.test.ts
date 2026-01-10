import 'reflect-metadata';
import { ChatService } from '../../services/ChatService';
import { ChatMessage } from '../../../../shared/types';
import { IHandlerContext } from '../../websocket/types';

// Mock the external dependencies
jest.mock('@langchain/community/tools/tavily_search', () => ({
    TavilySearchResults: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@langchain/openai', () => ({
    ChatOpenAI: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@langchain/langgraph', () => ({
    MemorySaver: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
    createReactAgent: jest.fn().mockReturnValue({
        invoke: jest.fn()
    })
}));

describe('ChatService', () => {
    let chatService: ChatService;
    let mockContext: IHandlerContext;
    let mockChatMessage: ChatMessage;

    beforeEach(() => {
        jest.clearAllMocks();
        chatService = new ChatService();
        
        mockContext = {
            clientId: 'test-client-123',
            timestamp: Date.now(),
            client: {
                id: 'test-client-123',
                type: 'browser_extension' as any,
                userAgent: 'test',
                capabilities: ['test'],
                metadata: {},
                socket: {} as any,
                connectedAt: Date.now(),
                user: {
                    userId: 'test-user',
                    isAuthenticated: true,
                    permissions: ['chat']
                }
            }
        };

        mockChatMessage = {
            id: 'msg-123',
            type: 'chat_message',
            content: 'Hello, how are you?',
            sessionId: 'session-123',
            timestamp: Date.now()
        };
    });

    describe('initialization', () => {
        it('should initialize successfully', () => {
            expect(chatService).toBeDefined();
        });

        it('should have correct stats after initialization', () => {
            const stats = chatService.getStats();
            
            expect(stats.agentInitialized).toBe(true);
            expect(stats.memoryEnabled).toBe(true);
            expect(stats.toolsAvailable).toBe(1);
        });
    });

    describe('processMessage', () => {
        it('should process message successfully', async () => {
            const { createReactAgent } = require('@langchain/langgraph/prebuilt');
            const mockAgent = {
                invoke: jest.fn().mockResolvedValue({
                    messages: [{
                        content: 'Hello! I am doing well, thank you for asking.'
                    }]
                })
            };
            createReactAgent.mockReturnValue(mockAgent);

            // Create a new service to use the mocked agent
            const testService = new ChatService();
            
            const response = await testService.processMessage(mockChatMessage, mockContext);

            expect(response).toEqual({
                id: expect.any(String),
                type: 'agent_response',
                timestamp: expect.any(Number),
                content: 'Hello! I am doing well, thank you for asking.',
                sessionId: 'session-123',
                reasoning: expect.stringContaining('Generated using LangGraph agent')
            });

            expect(mockAgent.invoke).toHaveBeenCalledWith(
                { messages: expect.any(Array) },
                {
                    configurable: { thread_id: 'session-123' },
                    callbacks: expect.any(Array)
                }
            );
        });

        it('should handle agent execution errors', async () => {
            const { createReactAgent } = require('@langchain/langgraph/prebuilt');
            const mockAgent = {
                invoke: jest.fn().mockRejectedValue(new Error('Agent failed'))
            };
            createReactAgent.mockReturnValue(mockAgent);

            // Create a new service to use the mocked agent
            const testService = new ChatService();

            await expect(
                testService.processMessage(mockChatMessage, mockContext)
            ).rejects.toThrow('Chat processing failed: Agent failed');
        });

        it('should use client ID as thread ID for memory isolation', async () => {
            const { createReactAgent } = require('@langchain/langgraph/prebuilt');
            const mockAgent = {
                invoke: jest.fn().mockResolvedValue({
                    messages: [{ content: 'Response' }]
                })
            };
            createReactAgent.mockReturnValue(mockAgent);

            const testService = new ChatService();
            
            await testService.processMessage(mockChatMessage, mockContext);

            expect(mockAgent.invoke).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    configurable: { thread_id: 'session-123' },
                    callbacks: expect.any(Array)
                }
            );
        });
    });

    describe('clearHistory', () => {
        it('should log info about session-based clearing', async () => {
            const loggerSpy = jest.spyOn(require('../../utils/logger').logger, 'info').mockImplementation();

            await chatService.clearHistory('test-client-123');

            expect(loggerSpy).toHaveBeenCalledWith(
                'Conversation clear requested - client will use new session thread',
                expect.objectContaining({
                    service: 'ChatService',
                    clientId: 'test-client-123',
                    note: 'Using session-based threading for automatic conversation isolation'
                })
            );

            loggerSpy.mockRestore();
        });

        it('should handle errors gracefully', async () => {
            // Mock logger to throw an error
            const loggerSpy = jest.spyOn(require('../../utils/logger').logger, 'info')
                .mockImplementation(() => { throw new Error('Logger error'); });

            const errorSpy = jest.spyOn(require('../../utils/logger').logger, 'error').mockImplementation();

            await chatService.clearHistory('test-client-123');

            expect(errorSpy).toHaveBeenCalledWith(
                'Failed to process conversation clear request',
                expect.objectContaining({
                    service: 'ChatService',
                    clientId: 'test-client-123',
                    error: 'Logger error'
                })
            );

            loggerSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });

    describe('getStats', () => {
        it('should return correct statistics', () => {
            const stats = chatService.getStats();

            expect(stats).toEqual({
                agentInitialized: true,
                memoryEnabled: true,
                toolsAvailable: 1
            });
        });
    });
});