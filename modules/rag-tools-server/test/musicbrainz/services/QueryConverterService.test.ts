import { OpenAIQueryConverter } from '../../../src/musicbrainz/services/QueryConverterService';
import { IChatLLM } from '../../../src/shared/types';
import { ILogger } from '../../../src/musicbrainz/interfaces/IMusicBrainzServices';

describe('OpenAIQueryConverter', () => {
    let mockLLMClient: jest.Mocked<IChatLLM>;
    let mockLogger: jest.Mocked<ILogger>;
    let converter: OpenAIQueryConverter;

    beforeEach(() => {
        mockLLMClient = {
            invoke: jest.fn()
        };

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn()
        };

        converter = new OpenAIQueryConverter(mockLLMClient, mockLogger);
    });

    describe('isAlreadyFormatted', () => {
        it('should return true for formatted queries', () => {
            expect(converter.isAlreadyFormatted('artist:Taylor Swift')).toBe(true);
            expect(converter.isAlreadyFormatted('release:Midnights AND artist:Taylor Swift')).toBe(true);
        });

        it('should return false for natural language queries', () => {
            expect(converter.isAlreadyFormatted('Taylor Swift artist')).toBe(false);
            expect(converter.isAlreadyFormatted('Find me songs by Taylor Swift')).toBe(false);
        });
    });

    describe('convertToMusicBrainzFormat', () => {
        it('should parse already formatted queries without calling LLM', async () => {
            const input = 'artist:Taylor Swift';

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'artist',
                query: 'Taylor Swift'
            });
            expect(mockLLMClient.invoke).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Using pre-formatted MusicBrainz query', {
                service: 'OpenAIQueryConverter',
                originalInput: input,
                entity: 'artist',
                query: 'Taylor Swift'
            });
        });

        it('should convert natural language queries using LLM', async () => {
            const input = 'Find Taylor Swift albums';
            const llmResponse = 'release:albums AND artist:Taylor Swift';

            mockLLMClient.invoke.mockResolvedValue({ content: llmResponse } as any);

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'release',
                query: 'albums AND artist:Taylor Swift'
            });
            expect(mockLLMClient.invoke).toHaveBeenCalledWith(expect.stringContaining(input));
            expect(mockLogger.info).toHaveBeenCalledWith('Converting natural language to MusicBrainz query', {
                service: 'OpenAIQueryConverter',
                originalInput: input
            });
        });

        it('should handle LLM responses without colons', async () => {
            const input = 'Find music';
            const llmResponse = 'some music query';

            mockLLMClient.invoke.mockResolvedValue({ content: llmResponse } as any);

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'release',
                query: 'some music query'
            });
        });

        it('should handle LLM errors gracefully with fallback', async () => {
            const input = 'Find music';
            const error = new Error('LLM failed');

            mockLLMClient.invoke.mockRejectedValue(error);

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'release',
                query: 'Find music'
            });
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to convert query using PromptTemplate', {
                service: 'OpenAIQueryConverter',
                originalInput: input,
                error: 'LLM failed'
            });
        });

        it('should handle complex formatted queries', async () => {
            const input = 'release:Midnights AND artist:Taylor Swift';

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'release',
                query: 'Midnights AND artist:Taylor Swift'
            });
        });

        it('should trim whitespace from parsed entities and queries', async () => {
            const input = '  artist  :  Taylor Swift  ';

            const result = await converter.convertToMusicBrainzFormat(input);

            expect(result).toEqual({
                entity: 'artist',
                query: 'Taylor Swift'
            });
        });

        it('should include the conversion prompt template correctly', async () => {
            const input = 'Test query';
            mockLLMClient.invoke.mockResolvedValue({ content: 'artist:test' } as any);

            await converter.convertToMusicBrainzFormat(input);

            const expectedPrompt = mockLLMClient.invoke.mock.calls[0][0];
            expect(expectedPrompt).toContain('You need to convert a natural language music query');
            expect(expectedPrompt).toContain('Test query');
            expect(expectedPrompt).toContain('RULES:');
            expect(expectedPrompt).toContain('EXAMPLES:');
        });
    });
});
