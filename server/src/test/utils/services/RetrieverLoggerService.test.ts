import { RetrieverLoggerService } from '../../../utils/services/RetrieverLoggerService';
import { ILangGraphConfig, IDataSanitizer } from '../../../utils/interfaces/ILangGraphServices';
import { logger } from '../../../utils/logger';
import { Document } from '@langchain/core/documents';

// Mock the logger
jest.mock('../../../utils/logger', () => ({
    logger: {
        debug: jest.fn()
    }
}));

describe('RetrieverLoggerService', () => {
    let service: RetrieverLoggerService;
    let mockConfig: ILangGraphConfig;
    let mockDataSanitizer: jest.Mocked<IDataSanitizer>;
    let mockLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        mockConfig = {
            sessionId: 'test-session',
            clientId: 'test-client',
            verbose: false
        };

        mockDataSanitizer = {
            sanitizeInput: jest.fn((input: string) => `sanitized_${input}`),
            sanitizeOutput: jest.fn((output: string) => `sanitized_${output}`),
            sanitizeToolInput: jest.fn((input: any) => ({ sanitized: input }))
        };

        mockLogger = logger as jest.Mocked<typeof logger>;
        
        service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

        // Clear mock calls before each test
        jest.clearAllMocks();
    });

    describe('logRetrieverStart', () => {
        it('should log retriever start when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const tags = ['tag1', 'tag2'];

            await service.logRetrieverStart('VectorRetriever', 'search query', 'run-123', 'parent-456', tags);

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                retrieverName: 'VectorRetriever',
                runId: 'run-123',
                parentRunId: 'parent-456',
                query: 'sanitized_search query',
                tags: ['tag1', 'tag2']
            });

            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith('search query');
        });

        it('should not log when verbose mode is disabled', async () => {
            await service.logRetrieverStart('VectorRetriever', 'search query', 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
            expect(mockDataSanitizer.sanitizeInput).not.toHaveBeenCalled();
        });

        it('should handle missing optional parameters when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            await service.logRetrieverStart('VectorRetriever', 'search query', 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                retrieverName: 'VectorRetriever',
                runId: 'run-123',
                parentRunId: undefined,
                query: 'sanitized_search query',
                tags: undefined
            });
        });

        it('should handle empty query when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            await service.logRetrieverStart('VectorRetriever', '', 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever started', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                retrieverName: 'VectorRetriever',
                runId: 'run-123',
                parentRunId: undefined,
                query: 'sanitized_',
                tags: undefined
            });

            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith('');
        });

        it('should handle long query when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const longQuery = 'A'.repeat(1000);

            await service.logRetrieverStart('VectorRetriever', longQuery, 'run-123');

            expect(mockDataSanitizer.sanitizeInput).toHaveBeenCalledWith(longQuery);
        });
    });

    describe('logRetrieverEnd', () => {
        it('should log retriever end when verbose mode is enabled', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const documents: Document[] = [
                { pageContent: 'Content 1', metadata: { source: 'doc1' } },
                { pageContent: 'Content 2 is longer', metadata: { source: 'doc2' } },
                { pageContent: 'Content 3', metadata: { source: 'doc3' } }
            ];

            await service.logRetrieverEnd(documents, 'run-123', 'parent-456');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: 'parent-456',
                documentCount: 3,
                totalContentLength: 37 // 9 + 19 + 9 - actual calculated length
            });
        });

        it('should not log when verbose mode is disabled', async () => {
            const documents: Document[] = [
                { pageContent: 'Content 1', metadata: {} }
            ];

            await service.logRetrieverEnd(documents, 'run-123');

            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should handle missing optional parameters when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const documents: Document[] = [
                { pageContent: 'Content', metadata: {} }
            ];

            await service.logRetrieverEnd(documents, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                documentCount: 1,
                totalContentLength: 7
            });
        });

        it('should handle empty documents array when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const documents: Document[] = [];

            await service.logRetrieverEnd(documents, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                documentCount: 0,
                totalContentLength: 0
            });
        });

        it('should calculate total content length correctly when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const documents: Document[] = [
                { pageContent: '', metadata: {} }, // 0 length
                { pageContent: 'Hello', metadata: {} }, // 5 length
                { pageContent: 'World!', metadata: {} } // 6 length
            ];

            await service.logRetrieverEnd(documents, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                documentCount: 3,
                totalContentLength: 11 // 0 + 5 + 6
            });
        });

        it('should handle documents with complex metadata when verbose', async () => {
            mockConfig.verbose = true;
            service = new RetrieverLoggerService(mockConfig, mockDataSanitizer);

            const documents: Document[] = [
                { 
                    pageContent: 'Document content', 
                    metadata: { 
                        source: 'complex-doc',
                        score: 0.95,
                        nested: { key: 'value' }
                    } 
                }
            ];

            await service.logRetrieverEnd(documents, 'run-123');

            expect(mockLogger.debug).toHaveBeenCalledWith('Retriever completed', {
                service: 'LangGraph',
                clientId: 'test-client',
                sessionId: 'test-session',
                runId: 'run-123',
                parentRunId: undefined,
                documentCount: 1,
                totalContentLength: 16
            });
        });
    });
});