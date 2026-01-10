import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { ChainValues } from '@langchain/core/utils/types';
import { LLMResult } from '@langchain/core/outputs';
import { Document } from '@langchain/core/documents';
import { Serialized } from '@langchain/core/load/serializable';

/**
 * Configuration for LangGraph callback services
 */
export interface ILangGraphConfig {
    sessionId: string;
    clientId: string;
    verbose: boolean;
}

/**
 * Log entry structure for LangGraph events
 */
export interface ILogEntry {
    service: string;
    clientId: string;
    sessionId: string;
    runId: string;
    parentRunId?: string;
    [key: string]: any;
}

/**
 * Service for sanitizing and formatting data for logging
 */
export interface IDataSanitizer {
    sanitizeInput(input: string): string;
    sanitizeOutput(output: string): string;
    sanitizeToolInput(input: any): any;
}

/**
 * Service for extracting names from LangChain Serialized objects
 */
export interface INameExtractor {
    extractName(serialized: Serialized): string;
    extractToolName(tool: Serialized): string;
    extractLLMName(llm: Serialized): string;
}

/**
 * Service for handling tool-related logging
 */
export interface IToolLogger {
    logToolStart(toolName: string, runId: string, parentRunId?: string, input?: string, tags?: string[], tool?: Serialized): Promise<void>;
    logToolEnd(runId: string, parentRunId?: string, output?: string): Promise<void>;
    logToolError(error: Error, runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Service for handling LLM-related logging
 */
export interface ILLMLogger {
    logLLMStart(llmName: string, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, unknown>, tags?: string[], llm?: Serialized): Promise<void>;
    logLLMEnd(output: LLMResult, runId: string, parentRunId?: string): Promise<void>;
    logLLMError(error: Error, runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Service for handling chain-related logging
 */
export interface IChainLogger {
    logChainStart(chainName: string, inputs: ChainValues, runId: string, parentRunId?: string, tags?: string[]): Promise<void>;
    logChainEnd(outputs: ChainValues, runId: string, parentRunId?: string): Promise<void>;
    logChainError(error: Error, runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Service for handling agent-related logging
 */
export interface IAgentLogger {
    logAgentAction(action: AgentAction, runId: string, parentRunId?: string): Promise<void>;
    logAgentEnd(action: AgentFinish, runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Service for handling retriever-related logging
 */
export interface IRetrieverLogger {
    logRetrieverStart(retrieverName: string, query: string, runId: string, parentRunId?: string, tags?: string[]): Promise<void>;
    logRetrieverEnd(documents: Document[], runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Main orchestrator interface for LangGraph callback functionality
 */
export interface ILangGraphCallbackOrchestrator {
    handleToolStart(tool: Serialized, input: string, runId: string, parentRunId?: string, tags?: string[]): Promise<void>;
    handleToolEnd(output: string, runId: string, parentRunId?: string): Promise<void>;
    handleToolError(error: Error, runId: string, parentRunId?: string): Promise<void>;
    handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, unknown>, tags?: string[]): Promise<void>;
    handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string): Promise<void>;
    handleLLMError(error: Error, runId: string, parentRunId?: string): Promise<void>;
    handleChainStart(chain: Serialized, inputs: ChainValues, runId: string, parentRunId?: string, tags?: string[]): Promise<void>;
    handleChainEnd(outputs: ChainValues, runId: string, parentRunId?: string): Promise<void>;
    handleChainError(error: Error, runId: string, parentRunId?: string): Promise<void>;
    handleAgentAction(action: AgentAction, runId: string, parentRunId?: string): Promise<void>;
    handleAgentEnd(action: AgentFinish, runId: string, parentRunId?: string): Promise<void>;
    handleRetrieverStart(retriever: Serialized, query: string, runId: string, parentRunId?: string, tags?: string[]): Promise<void>;
    handleRetrieverEnd(documents: Document[], runId: string, parentRunId?: string): Promise<void>;
}

/**
 * Implementation configuration for creating services
 */
export interface ILangGraphServiceConfig {
    config: ILangGraphConfig;
    dataSanitizer?: IDataSanitizer;
    nameExtractor?: INameExtractor;
    toolLogger?: IToolLogger;
    llmLogger?: ILLMLogger;
    chainLogger?: IChainLogger;
    agentLogger?: IAgentLogger;
    retrieverLogger?: IRetrieverLogger;
}