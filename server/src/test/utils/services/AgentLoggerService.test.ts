import { AgentLoggerService } from '../../../utils/services/AgentLoggerService';
import { ILangGraphConfig, IDataSanitizer } from '../../../utils/interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';
import { AgentAction, AgentFinish } from '@langchain/core/agents';

// Mock the logger
jest.mock('@jarvis/server-utils', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn()
    }
}));

describe('AgentLoggerService', () => {
    let service: AgentLoggerService;
    let mockConfig: ILangGraphConfig;
    let mockDataSanitizer: jest.Mocked<IDataSanitizer>;
    let mockLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        mockConfig = {
            sessionId: 'test-session',
            clientId: 'test-client',
            verbose: false
        };

        mockDataSanitizer = {
            sanitizeInput: jest.fn((input: string) => `sanitized_${input}`),
            sanitizeOutput: jest.fn((output: string) => `sanitized_${output}`),
            sanitizeToolInput: jest.fn((input: any) => ({ sanitized: input }))
        };

        mockLogger = logger as jest.Mocked<typeof logger>;

        service = new AgentLoggerService(mockConfig, mockDataSanitizer);

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('logAgentAction', () => {
        it('should log agent action with basic information', async () => {
            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test search' },
                log: 'Agent decided to search'
            };

            await service.logAgentAction(action, 'run-123', 'parent-456');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent action taken', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                tool: 'WebSearch',
                toolInputLength: JSON.stringify({ query: 'test search' }).length
            });
        });

        it('should handle missing optional parameters', async () => {
            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test' },
                log: 'Agent action'
            };

            await service.logAgentAction(action, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent action taken', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                tool: 'WebSearch',
                toolInputLength: JSON.stringify({ query: 'test' }).length
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new AgentLoggerService(mockConfig, mockDataSanitizer);

            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test search', type: 'web' },
                log: 'Agent decided to search for information'
            };

            await service.logAgentAction(action, 'run-123', 'parent-456');

            expect(mockLogger.debug).toHaveBeenCalledWith('Agent action details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                tool: 'WebSearch',
                toolInput: { sanitized: { query: 'test search', type: 'web' } },
                log: 'Agent decided to search for information'
            });

            expect(mockDataSanitizer.sanitizeToolInput).toHaveBeenCalledWith({ query: 'test search', type: 'web' });
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test' },
                log: 'Agent action'
            };

            await service.logAgentAction(action, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeToolInput).not.toHaveBeenCalled();
        });

        it('should handle empty tool input', async () => {
            const action: AgentAction = {
                tool: 'MemoryTool',
                toolInput: {},
                log: 'Memory access'
            };

            await service.logAgentAction(action, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent action taken', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                tool: 'MemoryTool',
                toolInputLength: 2 // JSON.stringify({}).length
            });
        });
    });

    describe('logAgentEnd', () => {
        it('should log agent finish with basic information', async () => {
            const action: AgentFinish = {
                returnValues: {
                    output: 'Final answer',
                    confidence: 0.95
                },
                log: 'Agent completed successfully'
            };

            await service.logAgentEnd(action, 'run-123', 'parent-456');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent execution finished', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                returnValuesKeys: ['output', 'confidence']
            });
        });

        it('should handle missing optional parameters', async () => {
            const action: AgentFinish = {
                returnValues: { output: 'Final answer' },
                log: 'Agent finished'
            };

            await service.logAgentEnd(action, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent execution finished', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                returnValuesKeys: ['output']
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new AgentLoggerService(mockConfig, mockDataSanitizer);

            const action: AgentFinish = {
                returnValues: {
                    output: 'Final detailed answer',
                    sources: ['source1', 'source2']
                },
                log: 'Agent completed with sources'
            };

            await service.logAgentEnd(action, 'run-123', 'parent-456');

            expect(mockLogger.debug).toHaveBeenCalledWith('Agent finish details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                log: 'Agent completed with sources',
                returnValues: { sanitized: { output: 'Final detailed answer', sources: ['source1', 'source2'] } }
            });

            expect(mockDataSanitizer.sanitizeToolInput).toHaveBeenCalledWith({
                output: 'Final detailed answer',
                sources: ['source1', 'source2']
            });
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            const action: AgentFinish = {
                returnValues: { output: 'Final answer' },
                log: 'Agent finished'
            };

            await service.logAgentEnd(action, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeToolInput).not.toHaveBeenCalled();
        });

        it('should handle empty return values', async () => {
            const action: AgentFinish = {
                returnValues: {},
                log: 'Agent finished with no output'
            };

            await service.logAgentEnd(action, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent execution finished', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                returnValuesKeys: []
            });
        });

        it('should handle complex return values structure', async () => {
            const action: AgentFinish = {
                returnValues: {
                    output: 'Answer',
                    metadata: {
                        timestamp: '2024-01-01',
                        version: '1.0'
                    },
                    sources: ['src1', 'src2']
                },
                log: 'Complex finish'
            };

            await service.logAgentEnd(action, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Agent execution finished', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                returnValuesKeys: ['output', 'metadata', 'sources']
            });
        });
    });
});