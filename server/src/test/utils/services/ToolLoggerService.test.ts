import { ToolLoggerService } from '../../../utils/services/ToolLoggerService';
import { ILangGraphConfig, IDataSanitizer } from '../../../utils/interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';
import { Serialized } from '@langchain/core/load/serializable';

// Mock the logger
jest.mock('@jarvis/server-utils', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn()
    }
}));

describe('ToolLoggerService', () => {
    let service: ToolLoggerService;
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

        service = new ToolLoggerService(mockConfig, mockDataSanitizer);

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('logToolStart', () => {
        it('should log tool start with basic information', async () => {
            await service.logToolStart('TestTool', 'run-123', 'parent-456', 'test input');

            expect(mockLogger.info).toHaveBeenCalledWith('Tool execution started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                toolName: 'TestTool',
                runId: 'run-123',
                parentRunId: 'parent-456',
                inputLength: 10
            });
        });

        it('should handle missing optional parameters', async () => {
            await service.logToolStart('TestTool', 'run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Tool execution started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                toolName: 'TestTool',
                runId: 'run-123',
                parentRunId: undefined,
                inputLength: 0
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ToolLoggerService(mockConfig, mockDataSanitizer);

            const mockTool = { name: 'TestTool' } as Serialized;

            await service.logToolStart(
                'TestTool',
                'run-123',
                'parent-456',
                'test input',
                ['tag1', 'tag2'],
                mockTool
            );

            expect(mockLogger.debug).toHaveBeenCalledWith('Tool input details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                toolName: 'TestTool',
                runId: 'run-123',
                input: 'sanitized_test input',
                tags: ['tag1', 'tag2'],
                toolStructure: mockTool
            });

            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith('test input');
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            await service.logToolStart('TestTool', 'run-123', undefined, 'test input');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeInput).not.toHaveBeenCalled();
        });
    });

    describe('logToolEnd', () => {
        it('should log tool completion with basic information', async () => {
            await service.logToolEnd('run-123', 'parent-456', 'test output');

            expect(mockLogger.info).toHaveBeenCalledWith('Tool execution completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                outputLength: 11
            });
        });

        it('should handle missing optional parameters', async () => {
            await service.logToolEnd('run-123');

            expect(mockLogger.info).toHaveBeenCalledWith('Tool execution completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                outputLength: 0
            });
        });

        it('should log verbose details when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ToolLoggerService(mockConfig, mockDataSanitizer);

            await service.logToolEnd('run-123', 'parent-456', 'test output');

            expect(mockLogger.debug).toHaveBeenCalledWith('Tool output details', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                output: 'sanitized_test output'
            });

            expect(mockDataSanitizer.sanitizeOutput).toHaveBeenCalledWith('test output');
        });

        it('should not log verbose details when verbose mode is disabled', async () => {
            await service.logToolEnd('run-123', undefined, 'test output');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeOutput).not.toHaveBeenCalled();
        });
    });

    describe('logToolError', () => {
        it('should log tool error with basic information', async () => {
            const error = new Error('Tool failed');
            error.stack = 'Error stack trace';

            await service.logToolError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('Tool execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'Tool failed',
                stack: undefined
            });
        });

        it('should include stack trace when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new ToolLoggerService(mockConfig, mockDataSanitizer);

            const error = new Error('Tool failed');
            error.stack = 'Error stack trace';

            await service.logToolError(error, 'run-123', 'parent-456');

            expect(mockLogger.error).toHaveBeenCalledWith('Tool execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                error: 'Tool failed',
                stack: 'Error stack trace'
            });
        });

        it('should handle missing optional parameters', async () => {
            const error = new Error('Tool failed');

            await service.logToolError(error, 'run-123');

            expect(mockLogger.error).toHaveBeenCalledWith('Tool execution failed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                error: 'Tool failed',
                stack: undefined
            });
        });
    });
});