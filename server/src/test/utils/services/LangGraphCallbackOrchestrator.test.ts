import { LangGraphCallbackOrchestrator } from '../../../utils/services/LangGraphCallbackOrchestrator';
import {
    ILangGraphConfig,
    INameExtractor,
    IToolLogger,
    ILLMLogger,
    IChainLogger,
    IAgentLogger,
    IRetrieverLogger
} from '../../../utils/interfaces/ILangGraphServices';
import { Serialized } from '@langchain/core/load/serializable';
import { LLMResult } from '@langchain/core/outputs';
import { ChainValues } from '@langchain/core/utils/types';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { Document } from '@langchain/core/documents';

describe('LangGraphCallbackOrchestrator', () => {
    let orchestrator: LangGraphCallbackOrchestrator;
    let mockConfig: ILangGraphConfig;
    let mockNameExtractor: jest.Mocked<INameExtractor>;
    let mockToolLogger: jest.Mocked<IToolLogger>;
    let mockLLMLogger: jest.Mocked<ILLMLogger>;
    let mockChainLogger: jest.Mocked<IChainLogger>;
    let mockAgentLogger: jest.Mocked<IAgentLogger>;
    let mockRetrieverLogger: jest.Mocked<IRetrieverLogger>;

    beforeEach(() => {
        mockConfig = {
            sessionId: 'test-session',
            clientId: 'test-client',
            verbose: false
        };

        mockNameExtractor = {
            extractName: jest.fn(),
            extractToolName: jest.fn(),
            extractLLMName: jest.fn()
        };

        mockToolLogger = {
            logToolStart: jest.fn(),
            logToolEnd: jest.fn(),
            logToolError: jest.fn()
        };

        mockLLMLogger = {
            logLLMStart: jest.fn(),
            logLLMEnd: jest.fn(),
            logLLMError: jest.fn()
        };

        mockChainLogger = {
            logChainStart: jest.fn(),
            logChainEnd: jest.fn(),
            logChainError: jest.fn()
        };

        mockAgentLogger = {
            logAgentAction: jest.fn(),
            logAgentEnd: jest.fn()
        };

        mockRetrieverLogger = {
            logRetrieverStart: jest.fn(),
            logRetrieverEnd: jest.fn()
        };

        orchestrator = new LangGraphCallbackOrchestrator(
            mockConfig,
            mockNameExtractor,
            mockToolLogger,
            mockLLMLogger,
            mockChainLogger,
            mockAgentLogger,
            mockRetrieverLogger
        );

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('tool handling', () => {
        it('should handle tool start', async () => {
            const tool = { name: 'TestTool' } as Serialized;
            mockNameExtractor.extractToolName.mockReturnValue('TestTool');

            await orchestrator.handleToolStart(tool, 'input', 'run-123', 'parent-456', ['tag1']);

            expect(mockNameExtractor.extractToolName).toHaveBeenCalledWith(tool);
            expect(mockToolLogger.logToolStart).toHaveBeenCalledWith('TestTool', 'run-123', 'parent-456', 'input', ['tag1'], tool);
        });

        it('should handle tool end', async () => {
            await orchestrator.handleToolEnd('output', 'run-123', 'parent-456');

            expect(mockToolLogger.logToolEnd).toHaveBeenCalledWith('run-123', 'parent-456', 'output');
        });

        it('should handle tool error', async () => {
            const error = new Error('Tool failed');

            await orchestrator.handleToolError(error, 'run-123', 'parent-456');

            expect(mockToolLogger.logToolError).toHaveBeenCalledWith(error, 'run-123', 'parent-456');
        });
    });

    describe('LLM handling', () => {
        it('should handle LLM start', async () => {
            const llm = { name: 'OpenAI' } as Serialized;
            const prompts = ['prompt1', 'prompt2'];
            const extraParams = { temperature: 0.7 };
            const tags = ['tag1'];

            mockNameExtractor.extractLLMName.mockReturnValue('OpenAI');

            await orchestrator.handleLLMStart(llm, prompts, 'run-123', 'parent-456', extraParams, tags);

            expect(mockNameExtractor.extractLLMName).toHaveBeenCalledWith(llm);
            expect(mockLLMLogger.logLLMStart).toHaveBeenCalledWith('OpenAI', prompts, 'run-123', 'parent-456', extraParams, tags, llm);
        });

        it('should handle LLM end', async () => {
            const output: LLMResult = {
                generations: [[{ text: 'response' }]],
                llmOutput: {}
            };

            await orchestrator.handleLLMEnd(output, 'run-123', 'parent-456');

            expect(mockLLMLogger.logLLMEnd).toHaveBeenCalledWith(output, 'run-123', 'parent-456');
        });

        it('should handle LLM error', async () => {
            const error = new Error('LLM failed');

            await orchestrator.handleLLMError(error, 'run-123', 'parent-456');

            expect(mockLLMLogger.logLLMError).toHaveBeenCalledWith(error, 'run-123', 'parent-456');
        });
    });

    describe('chain handling', () => {
        it('should handle chain start', async () => {
            const chain = { name: 'TestChain' } as Serialized;
            const inputs: ChainValues = { input1: 'value1' };
            const tags = ['tag1'];

            await orchestrator.handleChainStart(chain, inputs, 'run-123', 'parent-456', tags);

            expect(mockChainLogger.logChainStart).toHaveBeenCalledWith('TestChain', inputs, 'run-123', 'parent-456', tags);
        });

        it('should handle chain start with unnamed chain', async () => {
            const chain = {} as Serialized;
            const inputs: ChainValues = { input1: 'value1' };

            await orchestrator.handleChainStart(chain, inputs, 'run-123');

            expect(mockChainLogger.logChainStart).toHaveBeenCalledWith('unknown_chain', inputs, 'run-123', undefined, undefined);
        });

        it('should handle chain end', async () => {
            const outputs: ChainValues = { output1: 'result1' };

            await orchestrator.handleChainEnd(outputs, 'run-123', 'parent-456');

            expect(mockChainLogger.logChainEnd).toHaveBeenCalledWith(outputs, 'run-123', 'parent-456');
        });

        it('should handle chain error', async () => {
            const error = new Error('Chain failed');

            await orchestrator.handleChainError(error, 'run-123', 'parent-456');

            expect(mockChainLogger.logChainError).toHaveBeenCalledWith(error, 'run-123', 'parent-456');
        });
    });

    describe('agent handling', () => {
        it('should handle agent action', async () => {
            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test' },
                log: 'Agent action'
            };

            await orchestrator.handleAgentAction(action, 'run-123', 'parent-456');

            expect(mockAgentLogger.logAgentAction).toHaveBeenCalledWith(action, 'run-123', 'parent-456');
        });

        it('should handle agent end', async () => {
            const action: AgentFinish = {
                returnValues: { output: 'final answer' },
                log: 'Agent finished'
            };

            await orchestrator.handleAgentEnd(action, 'run-123', 'parent-456');

            expect(mockAgentLogger.logAgentEnd).toHaveBeenCalledWith(action, 'run-123', 'parent-456');
        });
    });

    describe('retriever handling', () => {
        it('should handle retriever start', async () => {
            const retriever = { name: 'VectorRetriever' } as Serialized;
            const tags = ['tag1'];

            await orchestrator.handleRetrieverStart(retriever, 'query', 'run-123', 'parent-456', tags);

            expect(mockRetrieverLogger.logRetrieverStart).toHaveBeenCalledWith('VectorRetriever', 'query', 'run-123', 'parent-456', tags);
        });

        it('should handle retriever start with unnamed retriever', async () => {
            const retriever = {} as Serialized;

            await orchestrator.handleRetrieverStart(retriever, 'query', 'run-123');

            expect(mockRetrieverLogger.logRetrieverStart).toHaveBeenCalledWith('unknown_retriever', 'query', 'run-123', undefined, undefined);
        });

        it('should handle retriever end', async () => {
            const documents: Document[] = [
                { pageContent: 'content1', metadata: {} },
                { pageContent: 'content2', metadata: {} }
            ];

            await orchestrator.handleRetrieverEnd(documents, 'run-123', 'parent-456');

            expect(mockRetrieverLogger.logRetrieverEnd).toHaveBeenCalledWith(documents, 'run-123', 'parent-456');
        });
    });

    describe('missing optional parameters', () => {
        it('should handle all methods with minimal parameters', async () => {
            const tool = { name: 'Tool' } as Serialized;
            const llm = { name: 'LLM' } as Serialized;
            const chain = { name: 'Chain' } as Serialized;
            const retriever = { name: 'Retriever' } as Serialized;
            const error = new Error('Test error');
            const llmResult: LLMResult = { generations: [], llmOutput: {} };
            const chainValues: ChainValues = {};
            const agentAction: AgentAction = { tool: 'Tool', toolInput: {}, log: 'log' };
            const agentFinish: AgentFinish = { returnValues: {}, log: 'log' };
            const documents: Document[] = [];

            mockNameExtractor.extractToolName.mockReturnValue('Tool');
            mockNameExtractor.extractLLMName.mockReturnValue('LLM');

            // Test all methods with minimal parameters
            await orchestrator.handleToolStart(tool, 'input', 'run-123');
            await orchestrator.handleToolEnd('output', 'run-123');
            await orchestrator.handleToolError(error, 'run-123');
            
            await orchestrator.handleLLMStart(llm, ['prompt'], 'run-123');
            await orchestrator.handleLLMEnd(llmResult, 'run-123');
            await orchestrator.handleLLMError(error, 'run-123');
            
            await orchestrator.handleChainStart(chain, chainValues, 'run-123');
            await orchestrator.handleChainEnd(chainValues, 'run-123');
            await orchestrator.handleChainError(error, 'run-123');
            
            await orchestrator.handleAgentAction(agentAction, 'run-123');
            await orchestrator.handleAgentEnd(agentFinish, 'run-123');
            
            await orchestrator.handleRetrieverStart(retriever, 'query', 'run-123');
            await orchestrator.handleRetrieverEnd(documents, 'run-123');

            // Verify all methods were called
            expect(mockToolLogger.logToolStart).toHaveBeenCalled();
            expect(mockToolLogger.logToolEnd).toHaveBeenCalled();
            expect(mockToolLogger.logToolError).toHaveBeenCalled();
            expect(mockLLMLogger.logLLMStart).toHaveBeenCalled();
            expect(mockLLMLogger.logLLMEnd).toHaveBeenCalled();
            expect(mockLLMLogger.logLLMError).toHaveBeenCalled();
            expect(mockChainLogger.logChainStart).toHaveBeenCalled();
            expect(mockChainLogger.logChainEnd).toHaveBeenCalled();
            expect(mockChainLogger.logChainError).toHaveBeenCalled();
            expect(mockAgentLogger.logAgentAction).toHaveBeenCalled();
            expect(mockAgentLogger.logAgentEnd).toHaveBeenCalled();
            expect(mockRetrieverLogger.logRetrieverStart).toHaveBeenCalled();
            expect(mockRetrieverLogger.logRetrieverEnd).toHaveBeenCalled();
        });
    });
});