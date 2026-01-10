import { MusicBrainzSearchTool } from '../../../../tools/musicbrainz/services/MusicBrainzSearchTool';
import { 
    IQueryConverter, 
    IMusicBrainzApiClient, 
    IResultFormatter, 
    IFallbackSearchStrategy, 
    ILogger, 
    MusicBrainzConfig,
    RateLimitError 
} from '../../../../tools/musicbrainz/interfaces/IMusicBrainzServices';

describe('MusicBrainzSearchTool', () => {
    let mockQueryConverter: jest.Mocked<IQueryConverter>;
    let mockApiClient: jest.Mocked<IMusicBrainzApiClient>;
    let mockFormatter: jest.Mocked<IResultFormatter>;
    let mockFallbackStrategy: jest.Mocked<IFallbackSearchStrategy>;
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: MusicBrainzConfig;
    let tool: MusicBrainzSearchTool;

    beforeEach(() => {
        mockQueryConverter = {
            convertToMusicBrainzFormat: jest.fn(),
            isAlreadyFormatted: jest.fn()
        };

        mockApiClient = {
            search: jest.fn(),
            getDetailedRelease: jest.fn(),
            validateEntity: jest.fn()
        };

        mockFormatter = {
            formatResults: jest.fn(),
            formatSingleResult: jest.fn()
        };

        mockFallbackStrategy = {
            shouldAttemptFallback: jest.fn(),
            createFallbackQuery: jest.fn()
        };

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn()
        };

        mockConfig = {
            baseUrl: 'https://test.musicbrainz.org',
            userAgent: 'Test/1.0',
            maxResults: 5,
            maxDetailRequests: 3,
            requestDelayMs: 100,
            fallbackEnabled: true
        };

        tool = new MusicBrainzSearchTool(
            mockQueryConverter,
            mockApiClient,
            mockFormatter,
            mockFallbackStrategy,
            mockLogger,
            mockConfig
        );
    });

    describe('search', () => {
        it('should perform successful search without fallback', async () => {
            // Setup mocks
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Taylor Swift'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            const mockSearchResult = { artists: [{ name: 'Taylor Swift' }] };
            mockApiClient.search.mockResolvedValue(mockSearchResult);
            
            mockFallbackStrategy.shouldAttemptFallback.mockReturnValue(false);
            mockFormatter.formatResults.mockReturnValue('Formatted results');
            
            // Execute
            const result = await tool.search('Taylor Swift');
            
            // Verify
            expect(mockQueryConverter.convertToMusicBrainzFormat).toHaveBeenCalledWith('Taylor Swift');
            expect(mockApiClient.validateEntity).toHaveBeenCalledWith('artist');
            expect(mockApiClient.search).toHaveBeenCalledWith('artist', 'Taylor Swift');
            expect(mockFallbackStrategy.shouldAttemptFallback).toHaveBeenCalledWith(mockSearchResult, 'Taylor Swift');
            expect(mockFormatter.formatResults).toHaveBeenCalledWith(mockSearchResult, 'artist', 'Taylor Swift');
            expect(result).toBe('Formatted results');
        });

        it('should perform fallback search when no results found', async () => {
            // Setup mocks for empty initial result
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'release',
                query: 'Complex Query AND artist:Someone'
            });
            mockApiClient.validateEntity.mockReturnValue('release');
            
            const emptyResult = { releases: [] };
            const fallbackResult = { releases: [{ title: 'Found Album' }] };
            
            mockApiClient.search
                .mockResolvedValueOnce(emptyResult)  // First call returns empty
                .mockResolvedValueOnce(fallbackResult); // Fallback call returns results
            
            mockFallbackStrategy.shouldAttemptFallback.mockReturnValue(true);
            mockFallbackStrategy.createFallbackQuery.mockReturnValue('Simplified Query');
            
            mockFormatter.formatResults.mockReturnValue('Fallback results');
            
            // Execute
            const result = await tool.search('Complex search query');
            
            // Verify fallback was attempted
            expect(mockApiClient.search).toHaveBeenCalledTimes(2);
            expect(mockFallbackStrategy.createFallbackQuery).toHaveBeenCalledWith('Complex Query AND artist:Someone', 'release');
            expect(mockApiClient.search).toHaveBeenLastCalledWith('release', 'Simplified Query');
            expect(mockFormatter.formatResults).toHaveBeenCalledWith(fallbackResult, 'release', 'Simplified Query');
            expect(result).toBe('Fallback results');
            
            expect(mockLogger.info).toHaveBeenCalledWith('No results found, trying fallback search', {
                service: 'MusicBrainzSearchTool',
                originalQuery: 'Complex Query AND artist:Someone'
            });
        });

        it('should use original results when fallback also returns empty', async () => {
            // Setup mocks
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Nonexistent Artist'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            const emptyResult = { artists: [] };
            
            mockApiClient.search.mockResolvedValue(emptyResult);
            mockFallbackStrategy.shouldAttemptFallback.mockReturnValue(true);
            mockFallbackStrategy.createFallbackQuery.mockReturnValue('Fallback Query');
            
            mockFormatter.formatResults.mockReturnValue('No results message');
            
            // Execute
            const result = await tool.search('Nonexistent Artist');
            
            // Should format original results since fallback also empty
            expect(mockFormatter.formatResults).toHaveBeenCalledTimes(1);
            expect(result).toBe('No results message');
        });

        it('should skip fallback when fallback is disabled', async () => {
            // Disable fallback in config
            const configWithoutFallback = { ...mockConfig, fallbackEnabled: false };
            const toolWithoutFallback = new MusicBrainzSearchTool(
                mockQueryConverter,
                mockApiClient,
                mockFormatter,
                mockFallbackStrategy,
                mockLogger,
                configWithoutFallback
            );
            
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Test'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            const emptyResult = { artists: [] };
            mockApiClient.search.mockResolvedValue(emptyResult);
            mockFormatter.formatResults.mockReturnValue('No results');
            
            // Execute
            const result = await toolWithoutFallback.search('Test');
            
            // Verify fallback was not attempted
            expect(mockFallbackStrategy.shouldAttemptFallback).not.toHaveBeenCalled();
            expect(mockApiClient.search).toHaveBeenCalledTimes(1);
            expect(result).toBe('No results');
        });

        it('should handle query conversion errors gracefully', async () => {
            const conversionError = new Error('Query conversion failed');
            mockQueryConverter.convertToMusicBrainzFormat.mockRejectedValue(conversionError);
            
            const result = await tool.search('problematic query');
            
            expect(mockLogger.error).toHaveBeenCalledWith('MusicBrainz search error', {
                service: 'MusicBrainzSearchTool',
                input: 'problematic query',
                error: 'Query conversion failed'
            });
            expect(result).toBe('MusicBrainz search failed: Query conversion failed');
        });

        it('should handle API errors gracefully', async () => {
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Test'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            const apiError = new Error('API request failed');
            mockApiClient.search.mockRejectedValue(apiError);
            
            const result = await tool.search('Test');
            
            expect(mockLogger.error).toHaveBeenCalledWith('MusicBrainz search error', {
                service: 'MusicBrainzSearchTool',
                input: 'Test',
                error: 'API request failed'
            });
            expect(result).toBe('MusicBrainz search failed: API request failed');
        });

        it('should handle rate limit errors specifically', async () => {
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Test'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            const rateLimitError = new RateLimitError();
            mockApiClient.search.mockRejectedValue(rateLimitError);
            
            const result = await tool.search('Test');
            
            expect(result).toBe('Rate limit exceeded. Please try again later.');
        });

        it('should handle unknown errors', async () => {
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'artist',
                query: 'Test'
            });
            mockApiClient.validateEntity.mockReturnValue('artist');
            
            // Throw a non-Error object
            mockApiClient.search.mockRejectedValue('Strange error');
            
            const result = await tool.search('Test');
            
            expect(result).toBe('MusicBrainz search failed with unknown error');
        });

        it('should log fallback completion with results count', async () => {
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'release',
                query: 'Original Query'
            });
            mockApiClient.validateEntity.mockReturnValue('release');
            
            const emptyResult = { releases: [] };
            const fallbackResult = { releases: [{ title: 'Album 1' }, { title: 'Album 2' }] };
            
            mockApiClient.search
                .mockResolvedValueOnce(emptyResult)
                .mockResolvedValueOnce(fallbackResult);
            
            mockFallbackStrategy.shouldAttemptFallback.mockReturnValue(true);
            mockFallbackStrategy.createFallbackQuery.mockReturnValue('Fallback Query');
            mockFormatter.formatResults.mockReturnValue('Results');
            
            await tool.search('Test');
            
            expect(mockLogger.info).toHaveBeenCalledWith('Fallback search completed', {
                service: 'MusicBrainzSearchTool',
                fallbackQuery: 'Fallback Query',
                resultsCount: 2
            });
        });
    });

    describe('entity validation', () => {
        it('should validate entity before searching', async () => {
            mockQueryConverter.convertToMusicBrainzFormat.mockResolvedValue({
                entity: 'invalid-entity',
                query: 'Test'
            });
            mockApiClient.validateEntity.mockReturnValue('release'); // Validated to release
            mockApiClient.search.mockResolvedValue({ releases: [] });
            mockFormatter.formatResults.mockReturnValue('Results');
            
            await tool.search('Test');
            
            expect(mockApiClient.validateEntity).toHaveBeenCalledWith('invalid-entity');
            expect(mockApiClient.search).toHaveBeenCalledWith('release', 'Test');
        });
    });
});