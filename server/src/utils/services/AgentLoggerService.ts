import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { IAgentLogger, ILangGraphConfig, IDataSanitizer } from '../interfaces/ILangGraphServices';
import { logger } from '../logger';

/**
 * Service for handling agent-related logging
 * Manages logging for agent actions and completions
 */
export class AgentLoggerService implements IAgentLogger {
    private readonly config: ILangGraphConfig;
    private readonly dataSanitizer: IDataSanitizer;

    constructor(config: ILangGraphConfig, dataSanitizer: IDataSanitizer) {
        this.config = config;
        this.dataSanitizer = dataSanitizer;
    }

    /**
     * Log agent action taken
     */
    async logAgentAction(
        action: AgentAction,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        logger.info('Agent action taken', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            runId,
            parentRunId,
            tool: action.tool,
            toolInputLength: JSON.stringify(action.toolInput).length
        });

        if (this.config.verbose) {
            logger.debug('Agent action details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                tool: action.tool,
                toolInput: this.dataSanitizer.sanitizeToolInput(action.toolInput),
                log: action.log
            });
        }
    }

    /**
     * Log agent execution finish
     */
    async logAgentEnd(
        action: AgentFinish,
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        logger.info('Agent execution finished', {
            service: 'LangGraph',
            clientId: this.config.clientId,
            sessionId: this.config.sessionId,
            runId,
            parentRunId,
            returnValuesKeys: Object.keys(action.returnValues)
        });

        if (this.config.verbose) {
            logger.debug('Agent finish details', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                log: action.log,
                returnValues: this.dataSanitizer.sanitizeToolInput(action.returnValues)
            });
        }
    }
}