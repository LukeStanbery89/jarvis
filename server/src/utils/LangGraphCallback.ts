import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { ChainValues } from '@langchain/core/utils/types';
import { LLMResult } from '@langchain/core/outputs';
import { Document } from '@langchain/core/documents';
import { Serialized } from '@langchain/core/load/serializable';
import { LangGraphCallbackFactory } from './factories/LangGraphCallbackFactory';
import { ILangGraphCallbackOrchestrator } from './interfaces/ILangGraphServices';

/**
 * Custom LangChain callback handler for comprehensive LangGraph logging
 * 
 * Captures:
 * - Tool invocations with inputs and outputs
 * - LLM calls with prompts and responses
 * - Agent reasoning steps and decisions
 * - Chain execution flow
 * - Error handling and debugging information
 */
export class LangGraphCallback extends BaseCallbackHandler {
    name = 'LangGraphCallback';
    private orchestrator: ILangGraphCallbackOrchestrator;

    constructor(sessionId: string, clientId: string) {
        super();
        this.orchestrator = LangGraphCallbackFactory.create(sessionId, clientId);
    }

    /**
     * Called when a tool starts executing
     */
    async handleToolStart(
        tool: Serialized,
        input: string,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        await this.orchestrator.handleToolStart(tool, input, runId, parentRunId, tags);
    }

    /**
     * Called when a tool finishes executing
     */
    async handleToolEnd(
        output: string,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleToolEnd(output, runId, parentRunId);
    }

    /**
     * Called when a tool encounters an error
     */
    async handleToolError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleToolError(error, runId, parentRunId);
    }

    /**
     * Called when LLM starts generating
     */
    async handleLLMStart(
        llm: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string,
        extraParams?: Record<string, unknown>,
        tags?: string[]
    ): Promise<void> {
        await this.orchestrator.handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags);
    }

    /**
     * Called when LLM finishes generating
     */
    async handleLLMEnd(
        output: LLMResult,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleLLMEnd(output, runId, parentRunId);
    }

    /**
     * Called when LLM encounters an error
     */
    async handleLLMError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleLLMError(error, runId, parentRunId);
    }

    /**
     * Called when a chain starts executing
     */
    async handleChainStart(
        chain: Serialized,
        inputs: ChainValues,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        await this.orchestrator.handleChainStart(chain, inputs, runId, parentRunId, tags);
    }

    /**
     * Called when a chain finishes executing
     */
    async handleChainEnd(
        outputs: ChainValues,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleChainEnd(outputs, runId, parentRunId);
    }

    /**
     * Called when a chain encounters an error
     */
    async handleChainError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleChainError(error, runId, parentRunId);
    }

    /**
     * Called when an agent takes an action
     */
    async handleAgentAction(
        action: AgentAction,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleAgentAction(action, runId, parentRunId);
    }

    /**
     * Called when an agent finishes
     */
    async handleAgentEnd(
        action: AgentFinish,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleAgentEnd(action, runId, parentRunId);
    }

    /**
     * Called when text is retrieved (for RAG systems)
     */
    async handleRetrieverStart(
        retriever: Serialized,
        query: string,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        await this.orchestrator.handleRetrieverStart(retriever, query, runId, parentRunId, tags);
    }

    /**
     * Called when retriever finishes
     */
    async handleRetrieverEnd(
        documents: Document[],
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.orchestrator.handleRetrieverEnd(documents, runId, parentRunId);
    }
}