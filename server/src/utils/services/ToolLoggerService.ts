import { Serialized } from '@langchain/core/load/serializable';
import { IToolLogger, ILangGraphConfig, IDataSanitizer } from '../interfaces/ILangGraphServices';
import { logger } from '../logger';

/**
 * Service for handling tool-related logging
 * Manages logging for tool start, end, and error events
 */
export class ToolLoggerService implements IToolLogger {
    private readonly config: ILangGraphConfig;
    private readonly dataSanitizer: IDataSanitizer;

    constructor(config: ILangGraphConfig, dataSanitizer: IDataSanitizer) {
        this.config = config;
        this.dataSanitizer = dataSanitizer;
    }

    /**
     * Log tool execution start
     */
    async logToolStart(
        toolName: string,
        runId: string,
        parentRunId?: string,
        input?: string,
        tags?: string[],
        tool?: Serialized
    ): Promise<void> {
        logger.info('Tool execution started', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            toolName,
            runId,
            parentRunId,
            inputLength: input?.length || 0
        });

        if (this.config.verbose && input) {
            logger.debug('Tool input details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                toolName,
                runId,
                input: this.dataSanitizer.sanitizeInput(input),
                tags,
                toolStructure: this.config.verbose ? tool : undefined
            });
        }
    }

    /**
     * Log tool execution completion
     */
    async logToolEnd(
        runId: string,
        parentRunId?: string,
        output?: string
    ): Promise<void> {
        logger.info('Tool execution completed', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            runId,
            parentRunId,
            outputLength: output?.length || 0
        });

        if (this.config.verbose && output) {
            logger.debug('Tool output details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                output: this.dataSanitizer.sanitizeOutput(output)
            });
        }
    }

    /**
     * Log tool execution error
     */
    async logToolError(
        error: Error,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        logger.error('Tool execution failed', {
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