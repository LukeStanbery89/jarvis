import { ChainValues } from '@langchain/core/utils/types';
import { IChainLogger, ILangGraphConfig } from '../interfaces/ILangGraphServices';
import { logger } from '../logger';

/**
 * Service for handling chain-related logging
 * Manages logging for chain start, end, and error events
 */
export class ChainLoggerService implements IChainLogger {
    private readonly config: ILangGraphConfig;

    constructor(config: ILangGraphConfig) {
        this.config = config;
    }

    /**
     * Log chain execution start
     */
    async logChainStart(
        chainName: string,
        inputs: ChainValues,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        if (this.config.verbose) {
            logger.debug('Chain execution started', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                chainName,
                runId,
                parentRunId,
                inputKeys: Object.keys(inputs),
                tags
            });
        }
    }

    /**
     * Log chain execution completion
     */
    async logChainEnd(
        outputs: ChainValues,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        if (this.config.verbose) {
            logger.debug('Chain execution completed', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                parentRunId,
                outputKeys: Object.keys(outputs)
            });
        }
    }

    /**
     * Log chain execution error
     */
    async logChainError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        logger.error('Chain execution failed', {
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