import { 
    IMusicBrainzApiClient, 
    IHttpClient, 
    ILogger, 
    MusicBrainzConfig, 
    SearchOptions, 
    SearchResult, 
    DetailedRelease,
    RateLimitError 
} from '../interfaces/IMusicBrainzServices';

/**
 * Service for interacting with the MusicBrainz API
 */
export class MusicBrainzApiClientService implements IMusicBrainzApiClient {
    private readonly validEntities = ['artist', 'release', 'recording', 'release-group', 'work', 'label'];

    constructor(
        private httpClient: IHttpClient,
        private config: MusicBrainzConfig,
        private logger: ILogger
    ) {}

    async search(entity: string, query: string, options?: SearchOptions): Promise<SearchResult> {
        const validEntity = this.validateEntity(entity);
        const url = this.buildSearchUrl(validEntity, query, options);

        this.logger.info('MusicBrainz search initiated', {
            service: 'MusicBrainzApiClient',
            entity: validEntity,
            query,
            url
        });

        const response = await this.httpClient.get(url, {
            headers: {
                'User-Agent': this.config.userAgent,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new RateLimitError('Rate limit exceeded. Please try again later.');
            }
            throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Log the results count for debugging
        const entityPlural = this.getEntityPlural(validEntity);
        const resultsCount = data[entityPlural]?.length || 0;

        this.logger.info('MusicBrainz search completed', {
            service: 'MusicBrainzApiClient',
            entity: validEntity,
            query,
            resultsCount
        });

        // For release searches, fetch detailed track listings
        if (validEntity === 'release' && resultsCount > 0) {
            return await this.enhanceWithTrackListings(data);
        }

        return data;
    }

    async getDetailedRelease(releaseId: string): Promise<DetailedRelease> {
        const url = `${this.config.baseUrl}/release/${releaseId}?fmt=json&inc=recordings`;
        
        this.logger.info('Fetching detailed track listing', {
            service: 'MusicBrainzApiClient',
            releaseId
        });

        const response = await this.httpClient.get(url, {
            headers: {
                'User-Agent': this.config.userAgent,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch release details: ${response.status} ${response.statusText}`);
        }

        const detailData = await response.json();
        
        this.logger.info('Track listing fetched successfully', {
            service: 'MusicBrainzApiClient',
            releaseId,
            trackCount: detailData.media?.[0]?.tracks?.length || 0
        });

        return detailData;
    }

    validateEntity(entity: string): string {
        return this.validEntities.includes(entity) ? entity : 'release';
    }

    private buildSearchUrl(entity: string, query: string, options?: SearchOptions): string {
        const params = new URLSearchParams({
            query: query,
            fmt: 'json',
            limit: (options?.limit || this.config.maxResults).toString()
        });

        // For releases, include recordings to get track listings
        if (entity === 'release' && (options?.includeRecordings !== false)) {
            params.append('inc', 'recordings+artist-credits');
        }

        return `${this.config.baseUrl}/${entity}/?${params}`;
    }

    private async enhanceWithTrackListings(data: SearchResult): Promise<SearchResult> {
        const results = data.releases || [];
        const enhancedResults = [];

        // Get detailed information for each release (up to maxDetailRequests to avoid too many API calls)
        for (let i = 0; i < Math.min(results.length, this.config.maxDetailRequests); i++) {
            const release = results[i];
            const releaseId = release.id;

            try {
                const detailData = await this.getDetailedRelease(releaseId);
                enhancedResults.push(detailData);
            } catch (error) {
                // If detail fetch fails, use original result
                enhancedResults.push(release);
                
                this.logger.warn('Failed to fetch track listing', {
                    service: 'MusicBrainzApiClient',
                    releaseId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            // Rate limiting: small delay between requests
            if (i < Math.min(results.length, this.config.maxDetailRequests) - 1) {
                await new Promise(resolve => setTimeout(resolve, this.config.requestDelayMs));
            }
        }

        // Replace the search results with enhanced results
        return { ...data, releases: enhancedResults };
    }

    private getEntityPlural(entity: string): string {
        return entity === 'release-group' ? 'release-groups' : `${entity}s`;
    }
}