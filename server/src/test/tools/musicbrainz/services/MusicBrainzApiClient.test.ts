import { MusicBrainzApiClientService } from '../../../../tools/musicbrainz/services/MusicBrainzApiClient';
import { 
    IHttpClient, 
    ILogger, 
    MusicBrainzConfig, 
    RateLimitError 
} from '../../../../tools/musicbrainz/interfaces/IMusicBrainzServices';

describe('MusicBrainzApiClientService', () => {
    let mockHttpClient: jest.Mocked<IHttpClient>;
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfig: MusicBrainzConfig;
    let apiClient: MusicBrainzApiClientService;

    beforeEach(() => {
        mockHttpClient = {
            get: jest.fn()
        };

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn()
        };

        mockConfig = {
            baseUrl: 'https://test-musicbrainz.org/ws/2',
            userAgent: 'Test-Agent/1.0',
            maxResults: 3,
            maxDetailRequests: 2,
            requestDelayMs: 50,
            fallbackEnabled: true
        };

        apiClient = new MusicBrainzApiClientService(mockHttpClient, mockConfig, mockLogger);
    });

    describe('validateEntity', () => {
        it('should return valid entities unchanged', () => {
            expect(apiClient.validateEntity('artist')).toBe('artist');
            expect(apiClient.validateEntity('release')).toBe('release');
            expect(apiClient.validateEntity('recording')).toBe('recording');
            expect(apiClient.validateEntity('release-group')).toBe('release-group');
            expect(apiClient.validateEntity('work')).toBe('work');
            expect(apiClient.validateEntity('label')).toBe('label');
        });

        it('should return default "release" for invalid entities', () => {
            expect(apiClient.validateEntity('invalid')).toBe('release');
            expect(apiClient.validateEntity('')).toBe('release');
            expect(apiClient.validateEntity('unknown')).toBe('release');
        });
    });

    describe('search', () => {
        const mockSearchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: jest.fn()
        };

        beforeEach(() => {
            mockHttpClient.get.mockResolvedValue(mockSearchResponse);
        });

        it('should perform basic search correctly', async () => {
            const searchData = { artists: [{ name: 'Taylor Swift', id: '123' }] };
            mockSearchResponse.json.mockResolvedValue(searchData);

            const result = await apiClient.search('artist', 'Taylor Swift');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'https://test-musicbrainz.org/ws/2/artist/?query=Taylor+Swift&fmt=json&limit=3',
                {
                    headers: {
                        'User-Agent': 'Test-Agent/1.0',
                        'Accept': 'application/json'
                    }
                }
            );
            expect(result).toBe(searchData);
            expect(mockLogger.info).toHaveBeenCalledWith('MusicBrainz search initiated', {
                service: 'MusicBrainzApiClient',
                entity: 'artist',
                query: 'Taylor Swift',
                url: expect.stringContaining('artist')
            });
        });

        it('should include recordings for release searches', async () => {
            const searchData = { releases: [{ title: 'Midnights', id: '456' }] };
            mockSearchResponse.json.mockResolvedValue(searchData);

            await apiClient.search('release', 'Midnights');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                expect.stringContaining('inc=recordings%2Bartist-credits'),
                expect.any(Object)
            );
        });

        it('should handle rate limit errors', async () => {
            mockHttpClient.get.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: jest.fn()
            });

            await expect(apiClient.search('artist', 'test')).rejects.toThrow(RateLimitError);
        });

        it('should handle other HTTP errors', async () => {
            mockHttpClient.get.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: jest.fn()
            });

            await expect(apiClient.search('artist', 'test')).rejects.toThrow('MusicBrainz API error: 500 Internal Server Error');
        });

        it('should enhance release results with track listings', async () => {
            const searchData = { 
                releases: [
                    { title: 'Album 1', id: 'rel1' },
                    { title: 'Album 2', id: 'rel2' }
                ] 
            };
            const detailData1 = { id: 'rel1', title: 'Album 1', media: [{ tracks: [] }] };
            const detailData2 = { id: 'rel2', title: 'Album 2', media: [{ tracks: [] }] };

            mockSearchResponse.json.mockResolvedValue(searchData);
            
            // Mock getDetailedRelease calls
            jest.spyOn(apiClient, 'getDetailedRelease')
                .mockResolvedValueOnce(detailData1)
                .mockResolvedValueOnce(detailData2);

            const result = await apiClient.search('release', 'test');

            expect(apiClient.getDetailedRelease).toHaveBeenCalledTimes(2);
            expect(result.releases).toEqual([detailData1, detailData2]);
        });

        it('should respect maxDetailRequests limit', async () => {
            const searchData = { 
                releases: [
                    { title: 'Album 1', id: 'rel1' },
                    { title: 'Album 2', id: 'rel2' },
                    { title: 'Album 3', id: 'rel3' },
                    { title: 'Album 4', id: 'rel4' }
                ] 
            };

            mockSearchResponse.json.mockResolvedValue(searchData);
            jest.spyOn(apiClient, 'getDetailedRelease').mockResolvedValue({ id: 'test' } as any);

            await apiClient.search('release', 'test');

            // Should only call getDetailedRelease maxDetailRequests times (2)
            expect(apiClient.getDetailedRelease).toHaveBeenCalledTimes(2);
        });

        it('should handle detail fetch failures gracefully', async () => {
            const searchData = { releases: [{ title: 'Album 1', id: 'rel1' }] };
            mockSearchResponse.json.mockResolvedValue(searchData);
            
            jest.spyOn(apiClient, 'getDetailedRelease').mockRejectedValue(new Error('Detail fetch failed'));

            const result = await apiClient.search('release', 'test');

            expect(result.releases).toEqual([{ title: 'Album 1', id: 'rel1' }]);
            expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch track listing', {
                service: 'MusicBrainzApiClient',
                releaseId: 'rel1',
                error: 'Detail fetch failed'
            });
        });
    });

    describe('getDetailedRelease', () => {
        it('should fetch detailed release information', async () => {
            const detailData = { id: 'test-id', title: 'Test Release', media: [] };
            const mockDetailResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue(detailData)
            };

            mockHttpClient.get.mockResolvedValue(mockDetailResponse);

            const result = await apiClient.getDetailedRelease('test-id');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'https://test-musicbrainz.org/ws/2/release/test-id?fmt=json&inc=recordings',
                {
                    headers: {
                        'User-Agent': 'Test-Agent/1.0',
                        'Accept': 'application/json'
                    }
                }
            );
            expect(result).toBe(detailData);
            expect(mockLogger.info).toHaveBeenCalledWith('Fetching detailed track listing', {
                service: 'MusicBrainzApiClient',
                releaseId: 'test-id'
            });
        });

        it('should handle failed detail requests', async () => {
            mockHttpClient.get.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: jest.fn()
            });

            await expect(apiClient.getDetailedRelease('invalid-id')).rejects.toThrow('Failed to fetch release details: 404 Not Found');
        });
    });

    describe('URL building', () => {
        it('should properly encode query parameters', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue({ artists: [] })
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            await apiClient.search('artist', 'Taylor Swift & The Band');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                expect.stringContaining('Taylor+Swift+%26+The+Band'),
                expect.any(Object)
            );
        });

        it('should use custom search options', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: jest.fn().mockResolvedValue({ artists: [] })
            };
            mockHttpClient.get.mockResolvedValue(mockResponse);

            await apiClient.search('artist', 'test', { limit: 10 });

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                expect.stringContaining('limit=10'),
                expect.any(Object)
            );
        });
    });
});