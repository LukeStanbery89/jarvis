import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { ChainValues } from '@langchain/core/utils/types';
import { LLMResult } from '@langchain/core/outputs';
import { Document } from '@langchain/core/documents';
import { Serialized } from '@langchain/core/load/serializable';
import {
    ILangGraphCallbackOrchestrator,
    ILangGraphConfig,
    INameExtractor,
    IToolLogger,
    ILLMLogger,
    IChainLogger,
    IAgentLogger,
    IRetrieverLogger
} from '../interfaces/ILangGraphServices';

/**
 * Main orchestrator for LangGraph callback functionality
 * Coordinates all specialized logging services
 */
export class LangGraphCallbackOrchestrator implements ILangGraphCallbackOrchestrator {
    private readonly config: ILangGraphConfig;
    private readonly nameExtractor: INameExtractor;
    private readonly toolLogger: IToolLogger;
    private readonly llmLogger: ILLMLogger;
    private readonly chainLogger: IChainLogger;
    private readonly agentLogger: IAgentLogger;
    private readonly retrieverLogger: IRetrieverLogger;

    constructor(
        config: ILangGraphConfig,
        nameExtractor: INameExtractor,
        toolLogger: IToolLogger,
        llmLogger: ILLMLogger,
        chainLogger: IChainLogger,
        agentLogger: IAgentLogger,
        retrieverLogger: IRetrieverLogger
    ) {
        this.config = config;
        this.nameExtractor = nameExtractor;
        this.toolLogger = toolLogger;
        this.llmLogger = llmLogger;
        this.chainLogger = chainLogger;
        this.agentLogger = agentLogger;
        this.retrieverLogger = retrieverLogger;
    }

    /**
     * Handle tool execution start
     */
    async handleToolStart(
        tool: Serialized,
        input: string,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        const toolName = this.nameExtractor.extractToolName(tool);
        await this.toolLogger.logToolStart(toolName, runId, parentRunId, input, tags, tool);
    }

    /**
     * Handle tool execution completion
     */
    async handleToolEnd(
        output: string,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.toolLogger.logToolEnd(runId, parentRunId, output);
    }

    /**
     * Handle tool execution error
     */
    async handleToolError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.toolLogger.logToolError(error, runId, parentRunId);
    }

    /**
     * Handle LLM generation start
     */
    async handleLLMStart(
        llm: Serialized,
        prompts: string[],
        runId: string,
        parentRunId?: string,
        extraParams?: Record<string, unknown>,
        tags?: string[]
    ): Promise<void> {
        const llmName = this.nameExtractor.extractLLMName(llm);
        await this.llmLogger.logLLMStart(llmName, prompts, runId, parentRunId, extraParams, tags, llm);
    }

    /**
     * Handle LLM generation completion
     */
    async handleLLMEnd(
        output: LLMResult,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.llmLogger.logLLMEnd(output, runId, parentRunId);
    }

    /**
     * Handle LLM generation error
     */
    async handleLLMError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.llmLogger.logLLMError(error, runId, parentRunId);
    }

    /**
     * Handle chain execution start
     */
    async handleChainStart(
        chain: Serialized,
        inputs: ChainValues,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        const chainName = chain.name || 'unknown_chain';
        await this.chainLogger.logChainStart(chainName, inputs, runId, parentRunId, tags);
    }

    /**
     * Handle chain execution completion
     */
    async handleChainEnd(
        outputs: ChainValues,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.chainLogger.logChainEnd(outputs, runId, parentRunId);
    }

    /**
     * Handle chain execution error
     */
    async handleChainError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.chainLogger.logChainError(error, runId, parentRunId);
    }

    /**
     * Handle agent action
     */
    async handleAgentAction(
        action: AgentAction,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.agentLogger.logAgentAction(action, runId, parentRunId);
    }

    /**
     * Handle agent completion
     */
    async handleAgentEnd(
        action: AgentFinish,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.agentLogger.logAgentEnd(action, runId, parentRunId);
    }

    /**
     * Handle retriever execution start
     */
    async handleRetrieverStart(
        retriever: Serialized,
        query: string,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        const retrieverName = retriever.name || 'unknown_retriever';
        await this.retrieverLogger.logRetrieverStart(retrieverName, query, runId, parentRunId, tags);
    }

    /**
     * Handle retriever execution completion
     */
    async handleRetrieverEnd(
        documents: Document[],
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        await this.retrieverLogger.logRetrieverEnd(documents, runId, parentRunId);
    }
}