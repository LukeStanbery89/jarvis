import { LLMLoggerService } from '../../../utils/services/LLMLoggerService';
import { ILangGraphConfig, IDataSanitizer } from '../../../utils/interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';
import { LLMResult } from '@langchain/core/outputs';
import { Serialized } from '@langchain/core/load/serializable';

// Mock the logger
jest.mock('@jarvis/server-utils', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    }
}));

describe('LLMLoggerService', () => {
    let service: LLMLoggerService;
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

        service = new LLMLoggerService(mockConfig, mockDataSanitizer);

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('logLLMStart', () => {
        it('should log LLM start with basic information', async () => {
            const prompts = ['prompt1', 'prompt2'];

            await service.logLLMStart('gpt-4', prompts, 'run-123', 'parent-456');

            expect(mockLogger.info).toHaveBeenCalledWith('LLM generation started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                llmName: 'gpt-4',
                runId: 'run-123',
                parentRunId: 'parent-456',
                promptCount: 2,
                totalPromptLength: 14
            });
        });

        it('should handle missing optional parameters', async () => {
            const prompts = ['prompt1'];

            await service.logLLMStart('gpt-4', prompts, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('LLM generation started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                llmName: 'gpt-4',
                runId: 'run-123',
                parentRunId: undefined,
                promptCount: 1,
                totalPromptLength: 7
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new LLMLoggerService(mockConfig, mockDataSanitizer);

            const prompts = ['prompt1', 'prompt2'];
            const extraParams = { temperature: 0.7 };
            const tags = ['tag1', 'tag2'];
            const mockLLM = { name: 'OpenAI' } as Serialized;

            await service.logLLMStart('gpt-4', prompts, 'run-123', 'parent-456', extraParams, tags, mockLLM);

            expect(mockLogger.debug).toHaveBeenCalledWith('LLM prompt details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                llmName: 'gpt-4',
                runId: 'run-123',
                prompts: ['sanitized_prompt1', 'sanitized_prompt2'],
                extraParams: { temperature: 0.7 },
                tags: ['tag1', 'tag2'],
                llmStructure: mockLLM
            });

            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith('prompt1');
            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith('prompt2');
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            const prompts = ['prompt1'];

            await service.logLLMStart('gpt-4', prompts, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeInput).not.toHaveBeenCalled();
        });
    });

    describe('logLLMEnd', () => {
        it('should log LLM completion with basic information', async () => {
            const mockResult: LLMResult = {
                generations: [[{
                    text: 'Generated response',
                    generationInfo: { finishReason: 'stop' }
                }]],
                llmOutput: {
                    tokenUsage: {
                        promptTokens: 10,
                        completionTokens: 5,
                        totalTokens: 15
                    }
                }
            };

            await service.logLLMEnd(mockResult, 'run-123', 'parent-456');

            expect(mockLogger.info).toHaveBeenCalledWith('LLM generation completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                responseLength: 18,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 5,
                    totalTokens: 15
                }
            });
        });

        it('should handle result without token usage', async () => {
            const mockResult: LLMResult = {
                generations: [[{
                    text: 'Generated response'
                }]],
                llmOutput: {}
            };

            await service.logLLMEnd(mockResult, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('LLM generation completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                responseLength: 18,
                tokenUsage: undefined
            });
        });

        it('should handle result without generations', async () => {
            const mockResult: LLMResult = {
                generations: [],
                llmOutput: {}
            };

            await service.logLLMEnd(mockResult, 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('LLM generation completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                responseLength: 0,
                tokenUsage: undefined
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new LLMLoggerService(mockConfig, mockDataSanitizer);

            const mockResult: LLMResult = {
                generations: [[{
                    text: 'Generated response',
                    generationInfo: { finishReason: 'stop' }
                }]],
                llmOutput: {}
            };

            await service.logLLMEnd(mockResult, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('LLM response details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                response: 'sanitized_Generated response',
                generationInfo: { finishReason: 'stop' }
            });

            expect(mockDataSanitizer.sanitizeOutput).toHaveBeenCalledWith('Generated response');
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            const mockResult: LLMResult = {
                generations: [[{
                    text: 'Generated response'
                }]],
                llmOutput: {}
            };

            await service.logLLMEnd(mockResult, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeOutput).not.toHaveBeenCalled();
        });
    });

    describe('logLLMError', () => {
        it('should log LLM error with basic information', async () => {
            const error = new Error('LLM failed');
            error.stack = 'Error stack trace';

            await service.logLLMError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('LLM generation failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'LLM failed',
                stack: undefined
            });
        });

        it('should include stack trace when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new LLMLoggerService(mockConfig, mockDataSanitizer);

            const error = new Error('LLM failed');
            error.stack = 'Error stack trace';

            await service.logLLMError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('LLM generation failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'LLM failed',
                stack: 'Error stack trace'
            });
        });

        it('should handle missing optional parameters', async () => {
            const error = new Error('LLM failed');

            await service.logLLMError(error, 'run-123');

            expect(mockLogger.error).toHaveBeenCalledWith('LLM generation failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                error: 'LLM failed',
                stack: undefined
            });
        });
    });
});