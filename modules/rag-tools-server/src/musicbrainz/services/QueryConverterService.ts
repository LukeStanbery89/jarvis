import { IChatLLM } from '../../shared/types';
import { IQueryConverter, ILogger, QueryConversionResult, QueryConversionError } from '../interfaces/IMusicBrainzServices';

/**
 * Service for converting natural language queries to MusicBrainz format
 */
export class OpenAIQueryConverter implements IQueryConverter {
    private readonly promptTemplate = `You need to convert a natural language music query into the correct MusicBrainz search format.

RULES:
- For albums: use "release:ALBUM_NAME AND artist:ARTIST_NAME"
- For artists: use "artist:ARTIST_NAME"  
- For songs: use "recording:SONG_NAME" or "recording:SONG_NAME AND artist:ARTIST_NAME"
- Always include both album name AND artist name when searching for albums
- Do not use quotes around the entire query, but you can use quotes around individual names if they contain special characters

EXAMPLES:
User query: "What is the track list of Sabrina Carpenter's album Short 'n Sweet?"
MusicBrainz query: release:Short n Sweet AND artist:Sabrina Carpenter

User query: "Find Taylor Swift's Midnights album"
MusicBrainz query: release:Midnights AND artist:Taylor Swift

User query: "Search for artist Sabrina Carpenter"
MusicBrainz query: artist:Sabrina Carpenter

User query: "Find the song Espresso"
MusicBrainz query: recording:Espresso

Convert this query to MusicBrainz format:
"{query}"

MusicBrainz query:`;

    constructor(
        private llmClient: IChatLLM,
        private logger: ILogger
    ) { }

    async convertToMusicBrainzFormat(input: string): Promise<QueryConversionResult> {
        if (this.isAlreadyFormatted(input)) {
            return this.parseFormattedQuery(input);
        }

        try {
            this.logger.info('Converting natural language to MusicBrainz query', {
                service: 'OpenAIQueryConverter',
                originalInput: input
            });

            const prompt = this.promptTemplate.replace('{query}', input);
            const result = await this.llmClient.invoke(prompt);
            const formattedQuery = result.content.toString().trim();

            this.logger.info('Converted query using PromptTemplate', {
                service: 'OpenAIQueryConverter',
                originalInput: input,
                convertedQuery: formattedQuery
            });

            return this.parseConvertedQuery(formattedQuery);

        } catch (error) {
            this.logger.error('Failed to convert query using PromptTemplate', {
                service: 'OpenAIQueryConverter',
                originalInput: input,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Fallback to using input as-is
            return { entity: 'release', query: input };
        }
    }

    isAlreadyFormatted(input: string): boolean {
        return input.includes(':');
    }

    private parseFormattedQuery(input: string): QueryConversionResult {
        const firstColonIndex = input.indexOf(':');
        const entity = input.substring(0, firstColonIndex).trim();
        const query = input.substring(firstColonIndex + 1).trim();

        this.logger.info('Using pre-formatted MusicBrainz query', {
            service: 'OpenAIQueryConverter',
            originalInput: input,
            entity,
            query
        });

        return { entity, query };
    }

    private parseConvertedQuery(formattedQuery: string): QueryConversionResult {
        if (formattedQuery.includes(':')) {
            const firstColonIndex = formattedQuery.indexOf(':');
            const entity = formattedQuery.substring(0, firstColonIndex).trim();
            const query = formattedQuery.substring(firstColonIndex + 1).trim();
            return { entity, query };
        } else {
            return { entity: 'release', query: formattedQuery };
        }
    }
}