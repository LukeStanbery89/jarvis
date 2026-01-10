import { LangGraphCallbackFactory } from '../../../utils/factories/LangGraphCallbackFactory';
import { ILangGraphConfig, ILangGraphServiceConfig } from '../../../utils/interfaces/ILangGraphServices';
import { DataSanitizerService } from '../../../utils/services/DataSanitizerService';
import { NameExtractorService } from '../../../utils/services/NameExtractorService';

describe('LangGraphCallbackFactory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('create', () => {
        it('should create orchestrator with production configuration', () => {
            process.env.VERBOSE_LOGGING = 'false';

            const orchestrator = LangGraphCallbackFactory.create('test-session', 'test-client');

            expect(orchestrator).toBeDefined();
            expect(orchestrator.handleToolStart).toBeDefined();
            expect(orchestrator.handleLLMStart).toBeDefined();
            expect(orchestrator.handleChainStart).toBeDefined();
            expect(orchestrator.handleAgentAction).toBeDefined();
            expect(orchestrator.handleRetrieverStart).toBeDefined();
        });

        it('should create orchestrator with verbose logging enabled', () => {
            process.env.VERBOSE_LOGGING = 'true';

            const orchestrator = LangGraphCallbackFactory.create('test-session', 'test-client');

            expect(orchestrator).toBeDefined();
        });

        it('should create orchestrator with verbose logging disabled by default', () => {
            delete process.env.VERBOSE_LOGGING;

            const orchestrator = LangGraphCallbackFactory.create('test-session', 'test-client');

            expect(orchestrator).toBeDefined();
        });

        it('should handle different session and client IDs', () => {
            const orchestrator1 = LangGraphCallbackFactory.create('session-1', 'client-1');
            const orchestrator2 = LangGraphCallbackFactory.create('session-2', 'client-2');

            expect(orchestrator1).toBeDefined();
            expect(orchestrator2).toBeDefined();
            expect(orchestrator1).not.toBe(orchestrator2);
        });
    });

    describe('createForTesting', () => {
        it('should create orchestrator for testing with verbose disabled', () => {
            const orchestrator = LangGraphCallbackFactory.createForTesting('test-session', 'test-client', false);

            expect(orchestrator).toBeDefined();
            expect(orchestrator.handleToolStart).toBeDefined();
        });

        it('should create orchestrator for testing with verbose enabled', () => {
            const orchestrator = LangGraphCallbackFactory.createForTesting('test-session', 'test-client', true);

            expect(orchestrator).toBeDefined();
            expect(orchestrator.handleLLMStart).toBeDefined();
        });

        it('should create orchestrator for testing with default verbose (false)', () => {
            const orchestrator = LangGraphCallbackFactory.createForTesting('test-session', 'test-client');

            expect(orchestrator).toBeDefined();
        });

        it('should create different instances for different parameters', () => {
            const orchestrator1 = LangGraphCallbackFactory.createForTesting('session-1', 'client-1', true);
            const orchestrator2 = LangGraphCallbackFactory.createForTesting('session-2', 'client-2', false);

            expect(orchestrator1).not.toBe(orchestrator2);
        });
    });

    describe('createWithConfig', () => {
        it('should create orchestrator with custom config and default services', () => {
            const config: ILangGraphConfig = {
                sessionId: 'custom-session',
                clientId: 'custom-client',
                verbose: true
            };

            const serviceConfig: ILangGraphServiceConfig = {
                config
            };

            const orchestrator = LangGraphCallbackFactory.createWithConfig(serviceConfig);

            expect(orchestrator).toBeDefined();
            expect(orchestrator.handleToolStart).toBeDefined();
        });

        it('should create orchestrator with custom data sanitizer', () => {
            const config: ILangGraphConfig = {
                sessionId: 'test-session',
                clientId: 'test-client',
                verbose: false
            };

            const customDataSanitizer = new DataSanitizerService(100, 200, 50);

            const serviceConfig: ILangGraphServiceConfig = {
                config,
                dataSanitizer: customDataSanitizer
            };

            const orchestrator = LangGraphCallbackFactory.createWithConfig(serviceConfig);

            expect(orchestrator).toBeDefined();
        });

        it('should create orchestrator with custom name extractor', () => {
            const config: ILangGraphConfig = {
                sessionId: 'test-session',
                clientId: 'test-client',
                verbose: false
            };

            const customNameExtractor = new NameExtractorService();

            const serviceConfig: ILangGraphServiceConfig = {
                config,
                nameExtractor: customNameExtractor
            };

            const orchestrator = LangGraphCallbackFactory.createWithConfig(serviceConfig);

            expect(orchestrator).toBeDefined();
        });

        it('should create orchestrator with all custom services', () => {
            const config: ILangGraphConfig = {
                sessionId: 'test-session',
                clientId: 'test-client',
                verbose: true
            };

            const customDataSanitizer = new DataSanitizerService();
            const customNameExtractor = new NameExtractorService();

            // Create mock services
            const mockToolLogger = {
                logToolStart: jest.fn(),
                logToolEnd: jest.fn(),
                logToolError: jest.fn()
            };

            const mockLLMLogger = {
                logLLMStart: jest.fn(),
                logLLMEnd: jest.fn(),
                logLLMError: jest.fn()
            };

            const mockChainLogger = {
                logChainStart: jest.fn(),
                logChainEnd: jest.fn(),
                logChainError: jest.fn()
            };

            const mockAgentLogger = {
                logAgentAction: jest.fn(),
                logAgentEnd: jest.fn()
            };

            const mockRetrieverLogger = {
                logRetrieverStart: jest.fn(),
                logRetrieverEnd: jest.fn()
            };

            const serviceConfig: ILangGraphServiceConfig = {
                config,
                dataSanitizer: customDataSanitizer,
                nameExtractor: customNameExtractor,
                toolLogger: mockToolLogger,
                llmLogger: mockLLMLogger,
                chainLogger: mockChainLogger,
                agentLogger: mockAgentLogger,
                retrieverLogger: mockRetrieverLogger
            };

            const orchestrator = LangGraphCallbackFactory.createWithConfig(serviceConfig);

            expect(orchestrator).toBeDefined();
        });

        it('should create orchestrator with partial custom services', () => {
            const config: ILangGraphConfig = {
                sessionId: 'test-session',
                clientId: 'test-client',
                verbose: false
            };

            const customDataSanitizer = new DataSanitizerService(50, 100, 25);

            const mockToolLogger = {
                logToolStart: jest.fn(),
                logToolEnd: jest.fn(),
                logToolError: jest.fn()
            };

            const serviceConfig: ILangGraphServiceConfig = {
                config,
                dataSanitizer: customDataSanitizer,
                toolLogger: mockToolLogger
                // Other services should use defaults
            };

            const orchestrator = LangGraphCallbackFactory.createWithConfig(serviceConfig);

            expect(orchestrator).toBeDefined();
        });
    });

    describe('integration tests', () => {
        it('should create working orchestrator that can handle method calls', async () => {
            const orchestrator = LangGraphCallbackFactory.create('test-session', 'test-client');

            // Test that the orchestrator can handle actual method calls without errors
            const mockTool = { name: 'TestTool' } as any;
            const mockLLM = { name: 'TestLLM' } as any;
            const mockChain = { name: 'TestChain' } as any;
            const mockRetriever = { name: 'TestRetriever' } as any;

            // These should not throw errors
            await expect(orchestrator.handleToolStart(mockTool, 'input', 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleToolEnd('output', 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleToolError(new Error('test'), 'run-123')).resolves.toBeUndefined();

            await expect(orchestrator.handleLLMStart(mockLLM, ['prompt'], 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleLLMEnd({ generations: [], llmOutput: {} }, 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleLLMError(new Error('test'), 'run-123')).resolves.toBeUndefined();

            await expect(orchestrator.handleChainStart(mockChain, {}, 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleChainEnd({}, 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleChainError(new Error('test'), 'run-123')).resolves.toBeUndefined();

            await expect(orchestrator.handleAgentAction({ tool: 'test', toolInput: {}, log: 'log' }, 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleAgentEnd({ returnValues: {}, log: 'log' }, 'run-123')).resolves.toBeUndefined();

            await expect(orchestrator.handleRetrieverStart(mockRetriever, 'query', 'run-123')).resolves.toBeUndefined();
            await expect(orchestrator.handleRetrieverEnd([], 'run-123')).resolves.toBeUndefined();
        });

        it('should create orchestrator for testing that works correctly', async () => {
            const orchestrator = LangGraphCallbackFactory.createForTesting('test-session', 'test-client', true);

            const mockTool = { name: 'TestTool' } as any;

            // Should work without throwing
            await expect(orchestrator.handleToolStart(mockTool, 'input', 'run-123')).resolves.toBeUndefined();
        });
    });
});