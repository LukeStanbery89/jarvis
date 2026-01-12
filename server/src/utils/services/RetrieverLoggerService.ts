import { Document } from '@langchain/core/documents';
import { IRetrieverLogger, ILangGraphConfig, IDataSanitizer } from '../interfaces/ILangGraphServices';
import { logger } from '@jarvis/server-utils';

/**
 * Service for handling retriever-related logging
 * Manages logging for retriever start and end events
 */
export class RetrieverLoggerService implements IRetrieverLogger {
    private readonly config: ILangGraphConfig;
    private readonly dataSanitizer: IDataSanitizer;

    constructor(config: ILangGraphConfig, dataSanitizer: IDataSanitizer) {
        this.config = config;
        this.dataSanitizer = dataSanitizer;
    }

    /**
     * Log retriever execution start
     */
    async logRetrieverStart(
        retrieverName: string,
        query: string,
        runId: string,
        parentRunId?: string,
        tags?: string[]
    ): Promise<void> {
        if (this.config.verbose) {
            logger.debug('Retriever started', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                retrieverName,
                runId,
                parentRunId,
                query: this.dataSanitizer.sanitizeInput(query),
                tags
            });
        }
    }

    /**
     * Log retriever execution completion
     */
    async logRetrieverEnd(
        documents: Document[],
        runId: string,
        parentRunId?: string
    ): Promise<void> {
        if (this.config.verbose) {
            logger.debug('Retriever completed', {
                service: 'LangGraph',
                clientId: this.config.clientId,
                sessionId: this.config.sessionId,
                runId,
                parentRunId,
                documentCount: documents.length,
                totalContentLength: documents.reduce((sum, doc) => sum + doc.pageContent.length, 0)
            });
        }
    }
}