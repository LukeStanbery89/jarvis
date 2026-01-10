import { IResultFormatter } from '../interfaces/IMusicBrainzServices';

/**
 * Service for formatting MusicBrainz search results
 */
export class ResultFormatterService implements IResultFormatter {
    private formatters = new Map<string, (item: any) => string>([
        ['artist', this.formatArtist.bind(this)],
        ['release', this.formatRelease.bind(this)],
        ['recording', this.formatRecording.bind(this)],
        ['release-group', this.formatReleaseGroup.bind(this)],
        ['work', this.formatWork.bind(this)],
        ['label', this.formatLabel.bind(this)]
    ]);

    formatResults(data: any, entity: string, query: string): string {
        const entityPlural = this.getEntityPlural(entity);
        const results = data[entityPlural] || [];

        if (results.length === 0) {
            return this.formatNoResults(entity, query);
        }

        const formattedResults = results.map((item: any) => 
            this.formatSingleResult(item, entity)
        ).join('\n\n');

        return `MusicBrainz ${entity} search results:\n\n${formattedResults}`;
    }

    formatSingleResult(item: any, entity: string): string {
        const formatter = this.formatters.get(entity) || this.formatGeneric.bind(this);
        return formatter(item);
    }

    private formatNoResults(entity: string, query: string): string {
        return `No ${entity} results found in MusicBrainz database for search query: "${query}". This could mean:
- The ${entity} doesn't exist in the database yet
- Try searching with different terms or entity types (artist, release, recording, etc.)
- For very new releases, they may not be catalogued yet
- Check spelling and try alternative names or spellings
- Try searching for the artist first, then looking at their releases`;
    }

    private formatArtist(artist: any): string {
        const name = artist.name || 'Unknown Artist';
        const type = artist.type || 'Unknown';
        const country = artist.country || 'Unknown';
        const lifeSpan = this.formatLifeSpan(artist['life-span']);
        const disambiguation = artist.disambiguation ? ` (${artist.disambiguation})` : '';

        let result = `**${name}**${disambiguation}`;
        result += `\n- Type: ${type}`;
        result += `\n- Country: ${country}`;
        if (lifeSpan) {
            result += `\n- ${lifeSpan}`;
        }
        if (artist.aliases && artist.aliases.length > 0) {
            const aliases = artist.aliases.slice(0, 3).map((a: any) => a.name).join(', ');
            result += `\n- Also known as: ${aliases}`;
        }
        if (artist.tags && artist.tags.length > 0) {
            const tags = artist.tags.slice(0, 5).map((t: any) => t.name).join(', ');
            result += `\n- Genres/Tags: ${tags}`;
        }

        return result;
    }

    private formatRelease(release: any): string {
        const title = release.title || 'Unknown Release';
        const date = release.date || 'Unknown date';
        const country = release.country || 'Unknown';
        const status = release.status || 'Unknown';
        const disambiguation = release.disambiguation ? ` (${release.disambiguation})` : '';

        let result = `**${title}**${disambiguation}`;
        result += `\n- Release Date: ${date}`;
        result += `\n- Country: ${country}`;
        result += `\n- Status: ${status}`;

        if (release['artist-credit'] && release['artist-credit'].length > 0) {
            const artists = release['artist-credit'].map((ac: any) => ac.artist?.name || ac.name).join(', ');
            result += `\n- Artist(s): ${artists}`;
        }

        if (release['label-info'] && release['label-info'].length > 0) {
            const labels = release['label-info'].map((li: any) => li.label?.name).filter(Boolean).join(', ');
            if (labels) {
                result += `\n- Label(s): ${labels}`;
            }
        }

        // Add track listing if available
        if (release.media && release.media.length > 0) {
            result += `\n\n**Track List:**`;
            release.media.forEach((medium: any, mediumIndex: number) => {
                if (release.media.length > 1) {
                    result += `\n\nDisc ${mediumIndex + 1}:`;
                }
                if (medium.tracks) {
                    medium.tracks.forEach((track: any) => {
                        const trackNumber = track.number || track.position || '?';
                        const trackTitle = track.recording?.title || track.title || 'Unknown Track';
                        const duration = track.recording?.length ? this.formatDuration(track.recording.length) : track.length ? this.formatDuration(track.length) : '';
                        result += `\n${trackNumber}. ${trackTitle}${duration ? ` - ${duration}` : ''}`;
                    });
                } else if (medium['track-count']) {
                    result += `\n(${medium['track-count']} tracks - details not available)`;
                }
            });
        }

        return result;
    }

    private formatRecording(recording: any): string {
        const title = recording.title || 'Unknown Recording';
        const length = recording.length ? this.formatDuration(recording.length) : 'Unknown length';
        const disambiguation = recording.disambiguation ? ` (${recording.disambiguation})` : '';

        let result = `**${title}**${disambiguation}`;
        result += `\n- Duration: ${length}`;

        if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
            const artists = recording['artist-credit'].map((ac: any) => ac.artist?.name || ac.name).join(', ');
            result += `\n- Artist(s): ${artists}`;
        }

        if (recording.releases && recording.releases.length > 0) {
            const releases = recording.releases.slice(0, 3).map((r: any) => r.title).join(', ');
            result += `\n- Appears on: ${releases}`;
        }

        return result;
    }

    private formatReleaseGroup(releaseGroup: any): string {
        const title = releaseGroup.title || 'Unknown Release Group';
        const type = releaseGroup['primary-type'] || 'Unknown';
        const date = releaseGroup['first-release-date'] || 'Unknown date';
        const disambiguation = releaseGroup.disambiguation ? ` (${releaseGroup.disambiguation})` : '';

        let result = `**${title}**${disambiguation}`;
        result += `\n- Type: ${type}`;
        result += `\n- First Release: ${date}`;

        if (releaseGroup['artist-credit'] && releaseGroup['artist-credit'].length > 0) {
            const artists = releaseGroup['artist-credit'].map((ac: any) => ac.artist?.name || ac.name).join(', ');
            result += `\n- Artist(s): ${artists}`;
        }

        if (releaseGroup['secondary-types'] && releaseGroup['secondary-types'].length > 0) {
            result += `\n- Secondary Types: ${releaseGroup['secondary-types'].join(', ')}`;
        }

        return result;
    }

    private formatWork(work: any): string {
        const title = work.title || 'Unknown Work';
        const type = work.type || 'Unknown';
        const disambiguation = work.disambiguation ? ` (${work.disambiguation})` : '';

        let result = `**${title}**${disambiguation}`;
        result += `\n- Type: ${type}`;

        if (work.attributes && work.attributes.length > 0) {
            const attrs = work.attributes.map((a: any) => `${a.type}: ${a.value}`).join(', ');
            result += `\n- Attributes: ${attrs}`;
        }

        return result;
    }

    private formatLabel(label: any): string {
        const name = label.name || 'Unknown Label';
        const type = label.type || 'Unknown';
        const country = label.country || 'Unknown';
        const lifeSpan = this.formatLifeSpan(label['life-span']);
        const disambiguation = label.disambiguation ? ` (${label.disambiguation})` : '';

        let result = `**${name}**${disambiguation}`;
        result += `\n- Type: ${type}`;
        result += `\n- Country: ${country}`;
        if (lifeSpan) {
            result += `\n- ${lifeSpan}`;
        }

        return result;
    }

    private formatGeneric(item: any): string {
        const name = item.name || item.title || 'Unknown';
        const disambiguation = item.disambiguation ? ` (${item.disambiguation})` : '';

        let result = `**${name}**${disambiguation}`;

        // Add any additional fields that might be useful
        Object.keys(item).forEach(key => {
            if (!['name', 'title', 'disambiguation', 'id', 'score'].includes(key) &&
                typeof item[key] === 'string' && item[key].length < 100) {
                result += `\n- ${key}: ${item[key]}`;
            }
        });

        return result;
    }

    private formatLifeSpan(lifeSpan: any): string {
        if (!lifeSpan) return '';

        const begin = lifeSpan.begin || '';
        const end = lifeSpan.end || '';
        const ended = lifeSpan.ended;

        if (begin && end) {
            return `Active: ${begin} - ${end}`;
        } else if (begin && ended) {
            return `Active: ${begin} - ?`;
        } else if (begin) {
            return `Active since: ${begin}`;
        } else if (end) {
            return `Active until: ${end}`;
        }

        return '';
    }

    private formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    private getEntityPlural(entity: string): string {
        return entity === 'release-group' ? 'release-groups' : `${entity}s`;
    }
}