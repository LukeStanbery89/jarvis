import { Serialized } from '@langchain/core/load/serializable';
import { LLMResult } from '@langchain/core/outputs';
import { ILLMLogger, ILangGraphConfig, IDataSanitizer } from '../interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';

/**
 * Service for handling LLM-related logging
 * Manages logging for LLM start, end, and error events
 */
export class LLMLoggerService implements ILLMLogger {
    private readonly config: ILangGraphConfig;
    private readonly dataSanitizer: IDataSanitizer;

    constructor(config: ILangGraphConfig, dataSanitizer: IDataSanitizer) {
        this.config = config;
        this.dataSanitizer = dataSanitizer;
    }

    /**
     * Log LLM generation start
     */
    async logLLMStart(
        llmName: string,
        prompts: string[],
        runId: string,
        parentRunId?: string,
        extraParams?: Record<string, unknown>,
        tags?: string[],
        llm?: Serialized
    ): Promise<void> {
        logger.info('LLM generation started', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            llmName,
            runId,
            parentRunId,
            promptCount: prompts.length,
            totalPromptLength: prompts.reduce((sum, p) => sum + p.length, 0)
        });

        if (this.config.verbose) {
            logger.debug('LLM prompt details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                llmName,
                runId,
                prompts: prompts.map(p => this.dataSanitizer.sanitizeInput(p)),
                extraParams,
                tags,
                llmStructure: this.config.verbose ? llm : undefined
            });
        }
    }

    /**
     * Log LLM generation completion
     */
    async logLLMEnd(
        output: LLMResult,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        const generation = output.generations[0]?.[0];
        const tokenUsage = output.llmOutput?.tokenUsage;

        logger.info('LLM generation completed', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            runId,
            parentRunId,
            responseLength: generation?.text?.length || 0,
            tokenUsage: tokenUsage ? {
                promptTokens: tokenUsage.promptTokens,
                completionTokens: tokenUsage.completionTokens,
                totalTokens: tokenUsage.totalTokens
            } : undefined
        });

        if (this.config.verbose && generation) {
            logger.debug('LLM response details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                response: this.dataSanitizer.sanitizeOutput(generation.text || ''),
                generationInfo: generation.generationInfo
            });
        }
    }

    /**
     * Log LLM generation error
     */
    async logLLMError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        logger.error('LLM generation failed', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            runId,
            parentRunId,
            error: error.message,
            stack: this.config.verbose ? error.stack : undefined
        });
    }
}