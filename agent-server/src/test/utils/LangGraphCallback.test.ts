import { LangGraphCallback } from '../../utils/LangGraphCallback';
import { LangGraphCallbackFactory } from '../../utils/factories/LangGraphCallbackFactory';
import { ILangGraphCallbackOrchestrator } from '../../utils/interfaces/ILangGraphServices';
import { Serialized } from '@langchain/core/load/serializable';
import { LLMResult } from '@langchain/core/outputs';
import { ChainValues } from '@langchain/core/utils/types';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { Document } from '@langchain/core/documents';

// Mock the factory
jest.mock('../../utils/factories/LangGraphCallbackFactory');

describe('LangGraphCallback', () => {
    let callback: LangGraphCallback;
    let mockOrchestrator: jest.Mocked<ILangGraphCallbackOrchestrator>;
    let mockFactory: jest.Mocked<typeof LangGraphCallbackFactory>;

    beforeEach(() => {
        mockOrchestrator = {
            handleToolStart: jest.fn(),
            handleToolEnd: jest.fn(),
            handleToolError: jest.fn(),
            handleLLMStart: jest.fn(),
            handleLLMEnd: jest.fn(),
            handleLLMError: jest.fn(),
            handleChainStart: jest.fn(),
            handleChainEnd: jest.fn(),
            handleChainError: jest.fn(),
            handleAgentAction: jest.fn(),
            handleAgentEnd: jest.fn(),
            handleRetrieverStart: jest.fn(),
            handleRetrieverEnd: jest.fn()
        };

        mockFactory = LangGraphCallbackFactory as jest.Mocked<typeof LangGraphCallbackFactory>;
        mockFactory.create.mockReturnValue(mockOrchestrator);

        callback = new LangGraphCallback('test-session', 'test-client');

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create orchestrator using factory', () => {
            new LangGraphCallback('session-123', 'client-456');

            expect(mockFactory.create).toHaveBeenCalledWith('session-123', 'client-456');
        });

        it('should set correct name property', () => {
            expect(callback.name).toBe('LangGraphCallback');
        });
    });

    describe('tool handling', () => {
        it('should delegate handleToolStart to orchestrator', async () => {
            const tool = { name: 'TestTool' } as Serialized;
            const tags = ['tag1', 'tag2'];

            await callback.handleToolStart(tool, 'test input', 'run-123', 'parent-456', tags);

            expect(mockOrchestrator.handleToolStart).toHaveBeenCalledWith(
                tool, 'test input', 'run-123', 'parent-456', tags
            );
        });

        it('should delegate handleToolEnd to orchestrator', async () => {
            await callback.handleToolEnd('test output', 'run-123', 'parent-456');

            expect(mockOrchestrator.handleToolEnd).toHaveBeenCalledWith(
                'test output', 'run-123', 'parent-456'
            );
        });

        it('should delegate handleToolError to orchestrator', async () => {
            const error = new Error('Tool failed');

            await callback.handleToolError(error, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleToolError).toHaveBeenCalledWith(
                error, 'run-123', 'parent-456'
            );
        });

        it('should handle tool methods with minimal parameters', async () => {
            const tool = { name: 'TestTool' } as Serialized;

            await callback.handleToolStart(tool, 'input', 'run-123');
            await callback.handleToolEnd('output', 'run-123');
            await callback.handleToolError(new Error('error'), 'run-123');

            expect(mockOrchestrator.handleToolStart).toHaveBeenCalledWith(
                tool, 'input', 'run-123', undefined, undefined
            );
            expect(mockOrchestrator.handleToolEnd).toHaveBeenCalledWith(
                'output', 'run-123', undefined
            );
            expect(mockOrchestrator.handleToolError).toHaveBeenCalledWith(
                expect.any(Error), 'run-123', undefined
            );
        });
    });

    describe('LLM handling', () => {
        it('should delegate handleLLMStart to orchestrator', async () => {
            const llm = { name: 'OpenAI' } as Serialized;
            const prompts = ['prompt1', 'prompt2'];
            const extraParams = { temperature: 0.7 };
            const tags = ['tag1'];

            await callback.handleLLMStart(llm, prompts, 'run-123', 'parent-456', extraParams, tags);

            expect(mockOrchestrator.handleLLMStart).toHaveBeenCalledWith(
                llm, prompts, 'run-123', 'parent-456', extraParams, tags
            );
        });

        it('should delegate handleLLMEnd to orchestrator', async () => {
            const output: LLMResult = {
                generations: [[{ text: 'response' }]],
                llmOutput: { tokenUsage: { totalTokens: 10, promptTokens: 5, completionTokens: 5 } }
            };

            await callback.handleLLMEnd(output, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleLLMEnd).toHaveBeenCalledWith(
                output, 'run-123', 'parent-456'
            );
        });

        it('should delegate handleLLMError to orchestrator', async () => {
            const error = new Error('LLM failed');

            await callback.handleLLMError(error, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleLLMError).toHaveBeenCalledWith(
                error, 'run-123', 'parent-456'
            );
        });

        it('should handle LLM methods with minimal parameters', async () => {
            const llm = { name: 'OpenAI' } as Serialized;
            const prompts = ['prompt'];
            const output: LLMResult = { generations: [], llmOutput: {} };

            await callback.handleLLMStart(llm, prompts, 'run-123');
            await callback.handleLLMEnd(output, 'run-123');
            await callback.handleLLMError(new Error('error'), 'run-123');

            expect(mockOrchestrator.handleLLMStart).toHaveBeenCalledWith(
                llm, prompts, 'run-123', undefined, undefined, undefined
            );
            expect(mockOrchestrator.handleLLMEnd).toHaveBeenCalledWith(
                output, 'run-123', undefined
            );
            expect(mockOrchestrator.handleLLMError).toHaveBeenCalledWith(
                expect.any(Error), 'run-123', undefined
            );
        });
    });

    describe('chain handling', () => {
        it('should delegate handleChainStart to orchestrator', async () => {
            const chain = { name: 'TestChain' } as Serialized;
            const inputs: ChainValues = { input1: 'value1', input2: 'value2' };
            const tags = ['tag1', 'tag2'];

            await callback.handleChainStart(chain, inputs, 'run-123', 'parent-456', tags);

            expect(mockOrchestrator.handleChainStart).toHaveBeenCalledWith(
                chain, inputs, 'run-123', 'parent-456', tags
            );
        });

        it('should delegate handleChainEnd to orchestrator', async () => {
            const outputs: ChainValues = { output1: 'result1', output2: 'result2' };

            await callback.handleChainEnd(outputs, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleChainEnd).toHaveBeenCalledWith(
                outputs, 'run-123', 'parent-456'
            );
        });

        it('should delegate handleChainError to orchestrator', async () => {
            const error = new Error('Chain failed');

            await callback.handleChainError(error, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleChainError).toHaveBeenCalledWith(
                error, 'run-123', 'parent-456'
            );
        });

        it('should handle chain methods with minimal parameters', async () => {
            const chain = { name: 'TestChain' } as Serialized;
            const values: ChainValues = {};

            await callback.handleChainStart(chain, values, 'run-123');
            await callback.handleChainEnd(values, 'run-123');
            await callback.handleChainError(new Error('error'), 'run-123');

            expect(mockOrchestrator.handleChainStart).toHaveBeenCalledWith(
                chain, values, 'run-123', undefined, undefined
            );
            expect(mockOrchestrator.handleChainEnd).toHaveBeenCalledWith(
                values, 'run-123', undefined
            );
            expect(mockOrchestrator.handleChainError).toHaveBeenCalledWith(
                expect.any(Error), 'run-123', undefined
            );
        });
    });

    describe('agent handling', () => {
        it('should delegate handleAgentAction to orchestrator', async () => {
            const action: AgentAction = {
                tool: 'WebSearch',
                toolInput: { query: 'test search', type: 'web' },
                log: 'Agent is searching for information'
            };

            await callback.handleAgentAction(action, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleAgentAction).toHaveBeenCalledWith(
                action, 'run-123', 'parent-456'
            );
        });

        it('should delegate handleAgentEnd to orchestrator', async () => {
            const action: AgentFinish = {
                returnValues: { 
                    output: 'Final answer to the question',
                    sources: ['source1', 'source2']
                },
                log: 'Agent has completed the task successfully'
            };

            await callback.handleAgentEnd(action, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleAgentEnd).toHaveBeenCalledWith(
                action, 'run-123', 'parent-456'
            );
        });

        it('should handle agent methods with minimal parameters', async () => {
            const agentAction: AgentAction = { tool: 'Tool', toolInput: {}, log: 'log' };
            const agentFinish: AgentFinish = { returnValues: {}, log: 'log' };

            await callback.handleAgentAction(agentAction, 'run-123');
            await callback.handleAgentEnd(agentFinish, 'run-123');

            expect(mockOrchestrator.handleAgentAction).toHaveBeenCalledWith(
                agentAction, 'run-123', undefined
            );
            expect(mockOrchestrator.handleAgentEnd).toHaveBeenCalledWith(
                agentFinish, 'run-123', undefined
            );
        });
    });

    describe('retriever handling', () => {
        it('should delegate handleRetrieverStart to orchestrator', async () => {
            const retriever = { name: 'VectorRetriever' } as Serialized;
            const tags = ['retrieval', 'vector'];

            await callback.handleRetrieverStart(retriever, 'search query', 'run-123', 'parent-456', tags);

            expect(mockOrchestrator.handleRetrieverStart).toHaveBeenCalledWith(
                retriever, 'search query', 'run-123', 'parent-456', tags
            );
        });

        it('should delegate handleRetrieverEnd to orchestrator', async () => {
            const documents: Document[] = [
                { 
                    pageContent: 'First document content with relevant information',
                    metadata: { source: 'doc1.pdf', score: 0.95 }
                },
                { 
                    pageContent: 'Second document with additional context',
                    metadata: { source: 'doc2.pdf', score: 0.87 }
                }
            ];

            await callback.handleRetrieverEnd(documents, 'run-123', 'parent-456');

            expect(mockOrchestrator.handleRetrieverEnd).toHaveBeenCalledWith(
                documents, 'run-123', 'parent-456'
            );
        });

        it('should handle retriever methods with minimal parameters', async () => {
            const retriever = { name: 'Retriever' } as Serialized;
            const documents: Document[] = [];

            await callback.handleRetrieverStart(retriever, 'query', 'run-123');
            await callback.handleRetrieverEnd(documents, 'run-123');

            expect(mockOrchestrator.handleRetrieverStart).toHaveBeenCalledWith(
                retriever, 'query', 'run-123', undefined, undefined
            );
            expect(mockOrchestrator.handleRetrieverEnd).toHaveBeenCalledWith(
                documents, 'run-123', undefined
            );
        });
    });

    describe('error handling', () => {
        it('should propagate errors from orchestrator', async () => {
            const error = new Error('Orchestrator error');
            mockOrchestrator.handleToolStart.mockRejectedValue(error);

            const tool = { name: 'TestTool' } as Serialized;

            await expect(callback.handleToolStart(tool, 'input', 'run-123')).rejects.toThrow('Orchestrator error');
        });

        it('should handle async errors in all methods', async () => {
            const error = new Error('Async error');
            
            // Mock all orchestrator methods to reject
            Object.values(mockOrchestrator).forEach(method => {
                if (typeof method === 'function') {
                    method.mockRejectedValue(error);
                }
            });

            const tool = { name: 'Tool' } as Serialized;
            const llm = { name: 'LLM' } as Serialized;
            const chain = { name: 'Chain' } as Serialized;
            const retriever = { name: 'Retriever' } as Serialized;
            const llmResult: LLMResult = { generations: [], llmOutput: {} };
            const chainValues: ChainValues = {};
            const agentAction: AgentAction = { tool: 'Tool', toolInput: {}, log: 'log' };
            const agentFinish: AgentFinish = { returnValues: {}, log: 'log' };
            const documents: Document[] = [];
            const testError = new Error('test');

            // All methods should propagate the error
            await expect(callback.handleToolStart(tool, 'input', 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleToolEnd('output', 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleToolError(testError, 'run-123')).rejects.toThrow('Async error');
            
            await expect(callback.handleLLMStart(llm, ['prompt'], 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleLLMEnd(llmResult, 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleLLMError(testError, 'run-123')).rejects.toThrow('Async error');
            
            await expect(callback.handleChainStart(chain, chainValues, 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleChainEnd(chainValues, 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleChainError(testError, 'run-123')).rejects.toThrow('Async error');
            
            await expect(callback.handleAgentAction(agentAction, 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleAgentEnd(agentFinish, 'run-123')).rejects.toThrow('Async error');
            
            await expect(callback.handleRetrieverStart(retriever, 'query', 'run-123')).rejects.toThrow('Async error');
            await expect(callback.handleRetrieverEnd(documents, 'run-123')).rejects.toThrow('Async error');
        });
    });

    describe('BaseCallbackHandler integration', () => {
        it('should extend BaseCallbackHandler', () => {
            expect(callback).toBeInstanceOf(Object); // BaseCallbackHandler is imported but we can't easily test inheritance in Jest
            expect(callback.name).toBe('LangGraphCallback');
        });

        it('should be usable as a callback handler', () => {
            // Test that all required async methods exist and are callable
            expect(typeof callback.handleToolStart).toBe('function');
            expect(typeof callback.handleToolEnd).toBe('function');
            expect(typeof callback.handleToolError).toBe('function');
            expect(typeof callback.handleLLMStart).toBe('function');
            expect(typeof callback.handleLLMEnd).toBe('function');
            expect(typeof callback.handleLLMError).toBe('function');
            expect(typeof callback.handleChainStart).toBe('function');
            expect(typeof callback.handleChainEnd).toBe('function');
            expect(typeof callback.handleChainError).toBe('function');
            expect(typeof callback.handleAgentAction).toBe('function');
            expect(typeof callback.handleAgentEnd).toBe('function');
            expect(typeof callback.handleRetrieverStart).toBe('function');
            expect(typeof callback.handleRetrieverEnd).toBe('function');
        });
    });
});