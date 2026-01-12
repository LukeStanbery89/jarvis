import { ResultFormatterService } from '../../../src/musicbrainz/services/ResultFormatterService';

describe('ResultFormatterService', () => {
    let formatter: ResultFormatterService;

    beforeEach(() => {
        formatter = new ResultFormatterService();
    });

    describe('formatResults', () => {
        it('should format empty results with helpful message', () => {
            const data = { artists: [] };

            const result = formatter.formatResults(data, 'artist', 'nonexistent');

            expect(result).toContain('No artist results found');
            expect(result).toContain('nonexistent');
            expect(result).toContain('Try searching with different terms');
        });

        it('should format single artist result', () => {
            const data = {
                artists: [{
                    name: 'Taylor Swift',
                    type: 'Person',
                    country: 'US',
                    'life-span': { begin: '1989' },
                    disambiguation: 'country singer'
                }]
            };

            const result = formatter.formatResults(data, 'artist', 'Taylor Swift');

            expect(result).toContain('MusicBrainz artist search results:');
            expect(result).toContain('**Taylor Swift** (country singer)');
            expect(result).toContain('Type: Person');
            expect(result).toContain('Country: US');
            expect(result).toContain('Active since: 1989');
        });

        it('should format multiple results', () => {
            const data = {
                releases: [
                    { title: 'Album 1', date: '2022' },
                    { title: 'Album 2', date: '2023' }
                ]
            };

            const result = formatter.formatResults(data, 'release', 'test');

            expect(result).toContain('Album 1');
            expect(result).toContain('Album 2');
            expect(result.split('\n\n').length).toBeGreaterThan(2);
        });
    });

    describe('formatSingleResult', () => {
        it('should format artist with all fields', () => {
            const artist = {
                name: 'Taylor Swift',
                type: 'Person',
                country: 'US',
                'life-span': { begin: '1989', end: '', ended: false },
                disambiguation: 'country singer',
                aliases: [{ name: 'T-Swift' }, { name: 'Tay' }],
                tags: [{ name: 'pop' }, { name: 'country' }]
            };

            const result = formatter.formatSingleResult(artist, 'artist');

            expect(result).toContain('**Taylor Swift** (country singer)');
            expect(result).toContain('Type: Person');
            expect(result).toContain('Country: US');
            expect(result).toContain('Active since: 1989');
            expect(result).toContain('Also known as: T-Swift, Tay');
            expect(result).toContain('Genres/Tags: pop, country');
        });

        it('should format release with track listing', () => {
            const release = {
                title: 'Midnights',
                date: '2022-10-21',
                country: 'US',
                status: 'Official',
                'artist-credit': [{ artist: { name: 'Taylor Swift' } }],
                media: [{
                    tracks: [
                        { number: '1', recording: { title: 'Lavender Haze', length: 201000 } },
                        { number: '2', recording: { title: 'Maroon', length: 218000 } }
                    ]
                }]
            };

            const result = formatter.formatSingleResult(release, 'release');

            expect(result).toContain('**Midnights**');
            expect(result).toContain('Release Date: 2022-10-21');
            expect(result).toContain('Artist(s): Taylor Swift');
            expect(result).toContain('**Track List:**');
            expect(result).toContain('1. Lavender Haze - 3:21');
            expect(result).toContain('2. Maroon - 3:38');
        });

        it('should format recording with basic info', () => {
            const recording = {
                title: 'Anti-Hero',
                length: 200640,
                'artist-credit': [{ artist: { name: 'Taylor Swift' } }],
                releases: [{ title: 'Midnights' }]
            };

            const result = formatter.formatSingleResult(recording, 'recording');

            expect(result).toContain('**Anti-Hero**');
            expect(result).toContain('Duration: 3:20');
            expect(result).toContain('Artist(s): Taylor Swift');
            expect(result).toContain('Appears on: Midnights');
        });

        it('should format release-group', () => {
            const releaseGroup = {
                title: 'Folklore',
                'primary-type': 'Album',
                'first-release-date': '2020-07-24',
                'artist-credit': [{ artist: { name: 'Taylor Swift' } }],
                'secondary-types': ['Studio album']
            };

            const result = formatter.formatSingleResult(releaseGroup, 'release-group');

            expect(result).toContain('**Folklore**');
            expect(result).toContain('Type: Album');
            expect(result).toContain('First Release: 2020-07-24');
            expect(result).toContain('Secondary Types: Studio album');
        });

        it('should format work', () => {
            const work = {
                title: 'Love Story',
                type: 'Song',
                attributes: [{ type: 'Key', value: 'D major' }]
            };

            const result = formatter.formatSingleResult(work, 'work');

            expect(result).toContain('**Love Story**');
            expect(result).toContain('Type: Song');
            expect(result).toContain('Attributes: Key: D major');
        });

        it('should format label', () => {
            const label = {
                name: 'Big Machine Records',
                type: 'Original Production',
                country: 'US',
                'life-span': { begin: '2005', ended: false }
            };

            const result = formatter.formatSingleResult(label, 'label');

            expect(result).toContain('**Big Machine Records**');
            expect(result).toContain('Type: Original Production');
            expect(result).toContain('Country: US');
            expect(result).toContain('Active since: 2005');
        });

        it('should format unknown entity types generically', () => {
            const item = {
                name: 'Unknown Item',
                customField: 'custom value',
                longField: 'a'.repeat(200)
            };

            const result = formatter.formatSingleResult(item, 'unknown');

            expect(result).toContain('**Unknown Item**');
            expect(result).toContain('customField: custom value');
            expect(result).not.toContain('longField');
        });
    });

    describe('duration formatting', () => {
        it('should format durations correctly', () => {
            const recording1 = { title: 'Short Song', length: 65000 };
            const recording2 = { title: 'Long Song', length: 600000 };

            const result1 = formatter.formatSingleResult(recording1, 'recording');
            const result2 = formatter.formatSingleResult(recording2, 'recording');

            expect(result1).toContain('Duration: 1:05');
            expect(result2).toContain('Duration: 10:00');
        });

        it('should pad seconds with leading zeros', () => {
            const recording = { title: 'Test Song', length: 125000 };

            const result = formatter.formatSingleResult(recording, 'recording');

            expect(result).toContain('Duration: 2:05');
        });
    });

    describe('life span formatting', () => {
        it('should format complete life spans', () => {
            const artist = {
                name: 'Test Artist',
                'life-span': { begin: '1990', end: '2020', ended: true }
            };

            const result = formatter.formatSingleResult(artist, 'artist');

            expect(result).toContain('Active: 1990 - 2020');
        });

        it('should format ongoing life spans', () => {
            const artist = {
                name: 'Test Artist',
                'life-span': { begin: '1990', ended: false }
            };

            const result = formatter.formatSingleResult(artist, 'artist');

            expect(result).toContain('Active since: 1990');
        });

        it('should format ended but unknown end date', () => {
            const artist = {
                name: 'Test Artist',
                'life-span': { begin: '1990', ended: true }
            };

            const result = formatter.formatSingleResult(artist, 'artist');

            expect(result).toContain('Active: 1990 - ?');
        });

        it('should handle missing life span', () => {
            const artist = { name: 'Test Artist' };

            const result = formatter.formatSingleResult(artist, 'artist');

            expect(result).not.toContain('Active');
        });
    });

    describe('edge cases', () => {
        it('should handle missing fields gracefully', () => {
            const item = {};

            const result = formatter.formatSingleResult(item, 'artist');

            expect(result).toContain('**Unknown Artist**');
            expect(result).toContain('Type: Unknown');
            expect(result).toContain('Country: Unknown');
        });

        it('should handle multi-disc releases', () => {
            const release = {
                title: 'Box Set',
                media: [
                    { tracks: [{ number: '1', recording: { title: 'Track 1' } }] },
                    { tracks: [{ number: '1', recording: { title: 'Disc 2 Track 1' } }] }
                ]
            };

            const result = formatter.formatSingleResult(release, 'release');

            expect(result).toContain('Disc 1:');
            expect(result).toContain('Disc 2:');
        });

        it('should handle releases with track counts but no track details', () => {
            const release = {
                title: 'Album',
                media: [{ 'track-count': 12 }]
            };

            const result = formatter.formatSingleResult(release, 'release');

            expect(result).toContain('(12 tracks - details not available)');
        });
    });
});
