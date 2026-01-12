import { ChainLoggerService } from '../../../utils/services/ChainLoggerService';
import { ILangGraphConfig } from '../../../utils/interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';
import { ChainValues } from '@langchain/core/utils/types';

// Mock the logger
jest.mock('@jarvis/server-utils', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

describe('ChainLoggerService', () => {
    let service: ChainLoggerService;
    let mockConfig: ILangGraphConfig;
    let mockLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        mockConfig = {
            sessionId: 'test-session',
            clientId: 'test-client',
            verbose: false
        };

        mockLogger = logger as jest.Mocked<typeof logger>;

        service = new ChainLoggerService(mockConfig);

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('logChainStart', () => {
        it('should log chain start when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const inputs: ChainValues = {
                input1: 'value1',
                input2: 'value2'
            };
            const tags = ['tag1', 'tag2'];

            await service.logChainStart('TestChain', inputs, 'run-123', 'parent-456', tags);

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                chainName: 'TestChain',
                runId: 'run-123',
                parentRunId: 'parent-456',
                inputKeys: ['input1', 'input2'],
                tags: ['tag1', 'tag2']
            });
        });

        it('should not log when verbose mode is disabled', async () => {
            const inputs: ChainValues = {
                input1: 'value1'
            };

            await service.logChainStart('TestChain', inputs, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should handle missing optional parameters', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const inputs: ChainValues = {
                input1: 'value1'
            };

            await service.logChainStart('TestChain', inputs, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                chainName: 'TestChain',
                runId: 'run-123',
                parentRunId: undefined,
                inputKeys: ['input1'],
                tags: undefined
            });
        });

        it('should handle empty inputs object', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const inputs: ChainValues = {};

            await service.logChainStart('TestChain', inputs, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                chainName: 'TestChain',
                runId: 'run-123',
                parentRunId: undefined,
                inputKeys: [],
                tags: undefined
            });
        });
    });

    describe('logChainEnd', () => {
        it('should log chain end when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const outputs: ChainValues = {
                output1: 'result1',
                output2: 'result2'
            };

            await service.logChainEnd(outputs, 'run-123', 'parent-456');

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                outputKeys: ['output1', 'output2']
            });
        });

        it('should not log when verbose mode is disabled', async () => {
            const outputs: ChainValues = {
                output1: 'result1'
            };

            await service.logChainEnd(outputs, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should handle missing optional parameters', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const outputs: ChainValues = {
                output1: 'result1'
            };

            await service.logChainEnd(outputs, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                outputKeys: ['output1']
            });
        });

        it('should handle empty outputs object', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const outputs: ChainValues = {};

            await service.logChainEnd(outputs, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Chain execution completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                outputKeys: []
            });
        });
    });

    describe('logChainError', () => {
        it('should log chain error with basic information', async () => {
            const error = new Error('Chain failed');
            error.stack = 'Error stack trace';

            await service.logChainError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('Chain execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'Chain failed',
                stack: undefined
            });
        });

        it('should include stack trace when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ChainLoggerService(mockConfig);

            const error = new Error('Chain failed');
            error.stack = 'Error stack trace';

            await service.logChainError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('Chain execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'Chain failed',
                stack: 'Error stack trace'
            });
        });

        it('should handle missing optional parameters', async () => {
            const error = new Error('Chain failed');

            await service.logChainError(error, 'run-123');

            expect(mockLogger.error).toHaveBeenCalledWith('Chain execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                error: 'Chain failed',
                stack: undefined
            });
        });

        it('should handle errors without stack trace', async () => {
            const error = new Error('Chain failed');
            delete error.stack;

            await service.logChainError(error, 'run-123');

            expect(mockLogger.error).toHaveBeenCalledWith('Chain execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                error: 'Chain failed',
                stack: undefined
            });
        });
    });
});