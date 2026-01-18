/**
 * Interfaces for MusicBrainz search services to enable dependency injection and testing
 */

export interface SearchOptions {
    limit?: number;
    includeRecordings?: boolean;
    includeArtistCredits?: boolean;
}

export interface SearchResult {
    [key: string]: any[];
}

export interface DetailedRelease {
    id: string;
    title: string;
    media?: Array<{
        tracks: Array<{
            number: string;
            title: string;
            length?: number;
            recording?: {
                title: string;
                length?: number;
            };
        }>;
    }>;
    [key: string]: any;
}

export interface QueryConversionResult {
    entity: string;
    query: string;
}

export interface IQueryConverter {
    convertToMusicBrainzFormat(input: string): Promise<QueryConversionResult>;
    isAlreadyFormatted(input: string): boolean;
}

export interface IMusicBrainzApiClient {
    search(entity: string, query: string, options?: SearchOptions): Promise<SearchResult>;
    getDetailedRelease(releaseId: string): Promise<DetailedRelease>;
    validateEntity(entity: string): string;
}

export interface IResultFormatter {
    formatResults(data: any, entity: string, query: string): string;
    formatSingleResult(item: any, entity: string): string;
}

export interface IFallbackSearchStrategy {
    shouldAttemptFallback(originalResult: SearchResult, query: string): boolean;
    createFallbackQuery(originalQuery: string, entity: string): string;
}

export interface IHttpClient {
    get(url: string, options?: { headers?: Record<string, string>; }): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        json(): Promise<any>;
    }>;
}

export interface ILogger {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
}

export interface MusicBrainzConfig {
    readonly baseUrl: string;
    readonly userAgent: string;
    readonly maxResults: number;
    readonly maxDetailRequests: number;
    readonly requestDelayMs: number;
    readonly fallbackEnabled: boolean;
}

export class MusicBrainzConfigImpl implements MusicBrainzConfig {
    constructor(
        public readonly baseUrl: string = 'https://musicbrainz.org/ws/2',
        public readonly userAgent: string = 'LangGraph-Agent/1.0 (@jarvis/server)',
        public readonly maxResults: number = 5,
        public readonly maxDetailRequests: number = 3,
        public readonly requestDelayMs: number = 100,
        public readonly fallbackEnabled: boolean = true
    ) { }

    static fromEnvironment(): MusicBrainzConfigImpl {
        return new MusicBrainzConfigImpl(
            process.env.MUSICBRAINZ_BASE_URL,
            process.env.MUSICBRAINZ_USER_AGENT,
            parseInt(process.env.MUSICBRAINZ_MAX_RESULTS || '5'),
            parseInt(process.env.MUSICBRAINZ_MAX_DETAIL_REQUESTS || '3'),
            parseInt(process.env.MUSICBRAINZ_REQUEST_DELAY_MS || '100'),
            process.env.MUSICBRAINZ_FALLBACK_ENABLED !== 'false'
        );
    }
}

export class RateLimitError extends Error {
    constructor(message: string = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class QueryConversionError extends Error {
    constructor(message: string, public readonly originalQuery: string) {
        super(message);
        this.name = 'QueryConversionError';
    }
}