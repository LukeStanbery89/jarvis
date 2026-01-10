import { 
    IQueryConverter, 
    IMusicBrainzApiClient, 
    IResultFormatter, 
    IFallbackSearchStrategy, 
    ILogger, 
    MusicBrainzConfig,
    RateLimitError 
} from '../interfaces/IMusicBrainzServices';

/**
 * Main orchestrator for MusicBrainz search functionality
 * Coordinates query conversion, API calls, fallback strategies, and result formatting
 */
export class MusicBrainzSearchTool {
    constructor(
        private queryConverter: IQueryConverter,
        private apiClient: IMusicBrainzApiClient,
        private formatter: IResultFormatter,
        private fallbackStrategy: IFallbackSearchStrategy,
        private logger: ILogger,
        private config: MusicBrainzConfig
    ) {}

    async search(input: string): Promise<string> {
        try {
            // 1. Convert query if needed
            const { entity, query } = await this.queryConverter.convertToMusicBrainzFormat(input);
            const validEntity = this.apiClient.validateEntity(entity);

            // 2. Perform main search
            const result = await this.apiClient.search(validEntity, query);

            // 3. Try fallback if no results and fallback is enabled
            if (this.config.fallbackEnabled && this.fallbackStrategy.shouldAttemptFallback(result, query)) {
                this.logger.info('No results found, trying fallback search', {
                    service: 'MusicBrainzSearchTool',
                    originalQuery: query
                });

                const fallbackQuery = this.fallbackStrategy.createFallbackQuery(query, validEntity);
                const fallbackResult = await this.apiClient.search(validEntity, fallbackQuery);
                
                this.logger.info('Fallback search completed', {
                    service: 'MusicBrainzSearchTool',
                    fallbackQuery,
                    resultsCount: this.countResults(fallbackResult)
                });

                if (this.countResults(fallbackResult) > 0) {
                    return this.formatter.formatResults(fallbackResult, validEntity, fallbackQuery);
                }
            }

            // 4. Format and return results
            return this.formatter.formatResults(result, validEntity, query);

        } catch (error) {
            this.logger.error('MusicBrainz search error', {
                service: 'MusicBrainzSearchTool',
                input,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            if (error instanceof RateLimitError) {
                return 'Rate limit exceeded. Please try again later.';
            }

            if (error instanceof Error) {
                return `MusicBrainz search failed: ${error.message}`;
            }
            
            return 'MusicBrainz search failed with unknown error';
        }
    }

    private countResults(result: any): number {
        let totalResults = 0;
        for (const key in result) {
            if (Array.isArray(result[key])) {
                totalResults += result[key].length;
            }
        }
        return totalResults;
    }
}