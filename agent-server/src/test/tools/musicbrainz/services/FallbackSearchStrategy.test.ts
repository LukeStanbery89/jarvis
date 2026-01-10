import { StandardFallbackStrategy } from '../../../../tools/musicbrainz/services/FallbackSearchStrategy';

describe('StandardFallbackStrategy', () => {
    let strategy: StandardFallbackStrategy;

    beforeEach(() => {
        strategy = new StandardFallbackStrategy();
    });

    describe('shouldAttemptFallback', () => {
        it('should return true when no results and complex query', () => {
            const emptyResult = { artists: [] };
            const complexQuery = 'artist:Taylor Swift AND album:Midnights';
            
            const result = strategy.shouldAttemptFallback(emptyResult, complexQuery);
            
            expect(result).toBe(true);
        });

        it('should return false when results exist', () => {
            const resultWithData = { artists: [{ name: 'Taylor Swift' }] };
            const complexQuery = 'artist:Taylor Swift AND album:Midnights';
            
            const result = strategy.shouldAttemptFallback(resultWithData, complexQuery);
            
            expect(result).toBe(false);
        });

        it('should return false when query is not complex', () => {
            const emptyResult = { artists: [] };
            const simpleQuery = 'artist:Taylor Swift';
            
            const result = strategy.shouldAttemptFallback(emptyResult, simpleQuery);
            
            expect(result).toBe(false);
        });

        it('should detect OR queries as complex', () => {
            const emptyResult = { artists: [] };
            const orQuery = 'artist:Taylor OR artist:Swift';
            
            const result = strategy.shouldAttemptFallback(emptyResult, orQuery);
            
            expect(result).toBe(true);
        });

        it('should count results across multiple entity types', () => {
            const mixedResult = { 
                artists: [], 
                releases: [{ title: 'Test Album' }] 
            };
            const complexQuery = 'release:Test AND artist:Someone';
            
            const result = strategy.shouldAttemptFallback(mixedResult, complexQuery);
            
            expect(result).toBe(false); // Has results in releases
        });
    });

    describe('createFallbackQuery', () => {
        it('should extract quoted terms correctly', () => {
            const originalQuery = 'release:"Midnights" AND artist:"Taylor Swift"';
            
            const result = strategy.createFallbackQuery(originalQuery, 'release');
            
            expect(result).toBe('release:"Midnights"');
        });

        it('should extract unquoted terms', () => {
            const originalQuery = 'release:Midnights AND artist:Taylor';
            
            const result = strategy.createFallbackQuery(originalQuery, 'release');
            
            expect(result).toBe('release:"Midnights"');
        });

        it('should extract entity-specific term when available', () => {
            const originalQuery = 'release:"Test Album" AND artist:"Someone"';
            
            const result = strategy.createFallbackQuery(originalQuery, 'artist');
            
            expect(result).toBe('artist:"Someone"'); // Extracts artist term
        });

        it('should handle queries without quoted or entity-specific terms', () => {
            const originalQuery = 'complex query AND something else';
            
            const result = strategy.createFallbackQuery(originalQuery, 'artist');
            
            expect(result).toBe('artist:complex query'); // First part before AND
        });

        it('should preserve entity prefix when already present', () => {
            const originalQuery = 'artist:test AND other:stuff';
            
            const result = strategy.createFallbackQuery(originalQuery, 'artist');
            
            expect(result).toBe('artist:"test"');
        });

        it('should handle empty or null extraction gracefully', () => {
            const originalQuery = 'AND something';
            
            const result = strategy.createFallbackQuery(originalQuery, 'release');
            
            expect(result).toBe('release:AND something');
        });

        it('should handle multiple quoted terms and pick the first matching entity', () => {
            const originalQuery = 'artist:"Taylor Swift" AND release:"Midnights" AND label:"Big Machine"';
            
            const result = strategy.createFallbackQuery(originalQuery, 'release');
            
            expect(result).toBe('release:"Midnights"');
        });

        it('should handle mixed quoted and unquoted terms', () => {
            const originalQuery = 'release:Folklore AND artist:"Taylor Swift"';
            
            const result = strategy.createFallbackQuery(originalQuery, 'release');
            
            expect(result).toBe('release:"Folklore"');
        });
    });

    describe('edge cases', () => {
        it('should handle empty result objects', () => {
            const emptyResult = {};
            const query = 'test AND query';
            
            const result = strategy.shouldAttemptFallback(emptyResult, query);
            
            expect(result).toBe(true);
        });

        it('should handle null values in results', () => {
            const resultWithNull = { artists: null as any };
            const query = 'test AND query';
            
            const result = strategy.shouldAttemptFallback(resultWithNull, query);
            
            expect(result).toBe(true);
        });

        it('should handle non-array values in results', () => {
            const resultWithNonArray = { artists: 'not an array' as any };
            const query = 'test AND query';
            
            const result = strategy.shouldAttemptFallback(resultWithNonArray, query);
            
            expect(result).toBe(true);
        });

        it('should handle queries with only spaces and AND', () => {
            const query = '   AND   ';
            
            const result = strategy.createFallbackQuery(query, 'artist');
            
            expect(result).toBe('artist:');
        });

        it('should handle very long entity names', () => {
            const longQuery = 'release:"' + 'a'.repeat(1000) + '" AND artist:"test"';
            
            const result = strategy.createFallbackQuery(longQuery, 'release');
            
            expect(result).toBe('release:"' + 'a'.repeat(1000) + '"');
        });
    });
});