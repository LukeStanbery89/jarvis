import { DynamicTool } from '@langchain/core/tools';
import { MusicBrainzSearchTool } from '../services/MusicBrainzSearchTool';
import { OpenAIQueryConverter } from '../services/QueryConverterService';
import { MusicBrainzApiClientService } from '../services/MusicBrainzApiClient';
import { ResultFormatterService } from '../services/ResultFormatterService';
import { StandardFallbackStrategy } from '../services/FallbackSearchStrategy';
import { FetchHttpClient } from '../../shared/services/HttpClient';
import { OpenAIChatClient } from '../../shared/services/LLMClient';
import { MusicBrainzConfigImpl } from '../interfaces/IMusicBrainzServices';
import { logger } from '../../../utils/logger';
import type {
    IQueryConverter,
    IMusicBrainzApiClient,
    IResultFormatter,
    IFallbackSearchStrategy,
    ILogger,
    IHttpClient,
    MusicBrainzConfig
} from '../interfaces/IMusicBrainzServices';
import { IChatLLM } from '../../shared/types';

/**
 * Factory for creating MusicBrainz search tools with proper dependency injection
 */
export class MusicBrainzSearchFactory {
    /**
     * Create a production-ready MusicBrainz search tool
     */
    static create(config?: MusicBrainzConfig): DynamicTool {
        const finalConfig = config || MusicBrainzConfigImpl.fromEnvironment();

        // Create HTTP client
        const httpClient: IHttpClient = new FetchHttpClient();

        // Create LLM client
        const llmClient: IChatLLM = new OpenAIChatClient({
            modelName: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            temperature: 0
        });

        // Create services
        const queryConverter: IQueryConverter = new OpenAIQueryConverter(llmClient, logger);
        const apiClient: IMusicBrainzApiClient = new MusicBrainzApiClientService(httpClient, finalConfig, logger);
        const formatter: IResultFormatter = new ResultFormatterService();
        const fallbackStrategy: IFallbackSearchStrategy = new StandardFallbackStrategy();

        // Create the main tool
        const searchTool = new MusicBrainzSearchTool(
            queryConverter,
            apiClient,
            formatter,
            fallbackStrategy,
            logger,
            finalConfig
        );

        // Return as DynamicTool to maintain compatibility with existing code
        return new DynamicTool({
            name: 'musicbrainz_search',
            description: `Primary tool for album track lists and basic music artist information.`,
            func: async (input: string) => searchTool.search(input)
        });
    }

    /**
     * Create a testable MusicBrainz search tool with mocked dependencies
     */
    static createForTesting(mocks: {
        queryConverter?: IQueryConverter,
        apiClient?: IMusicBrainzApiClient,
        formatter?: IResultFormatter,
        fallbackStrategy?: IFallbackSearchStrategy,
        logger?: ILogger,
        config?: MusicBrainzConfig;
    }): MusicBrainzSearchTool {
        return new MusicBrainzSearchTool(
            mocks.queryConverter || new OpenAIQueryConverter(new OpenAIChatClient(), logger),
            mocks.apiClient || new MusicBrainzApiClientService(new FetchHttpClient(), new MusicBrainzConfigImpl(), logger),
            mocks.formatter || new ResultFormatterService(),
            mocks.fallbackStrategy || new StandardFallbackStrategy(),
            mocks.logger || logger,
            mocks.config || new MusicBrainzConfigImpl()
        );
    }

    /**
     * Create the underlying search tool without DynamicTool wrapper (for direct testing)
     */
    static createSearchTool(config?: MusicBrainzConfig): MusicBrainzSearchTool {
        const finalConfig = config || MusicBrainzConfigImpl.fromEnvironment();

        const httpClient: IHttpClient = new FetchHttpClient();
        const llmClient: IChatLLM = new OpenAIChatClient();

        const queryConverter: IQueryConverter = new OpenAIQueryConverter(llmClient, logger);
        const apiClient: IMusicBrainzApiClient = new MusicBrainzApiClientService(httpClient, finalConfig, logger);
        const formatter: IResultFormatter = new ResultFormatterService();
        const fallbackStrategy: IFallbackSearchStrategy = new StandardFallbackStrategy();

        return new MusicBrainzSearchTool(
            queryConverter,
            apiClient,
            formatter,
            fallbackStrategy,
            logger,
            finalConfig
        );
    }
}