import { DynamicTool } from '@langchain/core/tools';
import { MusicBrainzSearchFactory } from '../../../../tools/musicbrainz/factories/MusicBrainzSearchFactory';
import { MusicBrainzSearchTool } from '../../../../tools/musicbrainz/services/MusicBrainzSearchTool';
import { MusicBrainzConfigImpl } from '../../../../tools/musicbrainz/interfaces/IMusicBrainzServices';

// Mock the logger
jest.mock('../../../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock external dependencies to avoid real API calls
jest.mock('../../../../tools/shared/services/HttpClient');
jest.mock('../../../../tools/shared/services/LLMClient');

describe('MusicBrainzSearchFactory', () => {
    describe('create', () => {
        it('should create a DynamicTool with correct properties', () => {
            const tool = MusicBrainzSearchFactory.create();
            
            expect(tool).toBeInstanceOf(DynamicTool);
            expect(tool.name).toBe('musicbrainz_search');
            expect(tool.description).toBe('Primary tool for album track lists and basic music artist information.');
            expect(typeof tool.func).toBe('function');
        });

        it('should create tool with custom config', () => {
            const customConfig = new MusicBrainzConfigImpl(
                'https://custom.musicbrainz.org',
                'Custom-Agent/1.0',
                10,
                5,
                200,
                false
            );
            
            const tool = MusicBrainzSearchFactory.create(customConfig);
            
            expect(tool).toBeInstanceOf(DynamicTool);
            expect(tool.name).toBe('musicbrainz_search');
        });

        it('should create tool with default config from environment', () => {
            // Set environment variables
            process.env.MUSICBRAINZ_BASE_URL = 'https://env.musicbrainz.org';
            process.env.MUSICBRAINZ_MAX_RESULTS = '7';
            
            const tool = MusicBrainzSearchFactory.create();
            
            expect(tool).toBeInstanceOf(DynamicTool);
            
            // Clean up
            delete process.env.MUSICBRAINZ_BASE_URL;
            delete process.env.MUSICBRAINZ_MAX_RESULTS;
        });

        it('should use compressed description format', () => {
            const tool = MusicBrainzSearchFactory.create();
            
            expect(tool.description).toBe('Primary tool for album track lists and basic music artist information.');
            expect(tool.description.length).toBeLessThan(100); // Ensure it's compressed
        });
    });

    describe('createForTesting', () => {
        it('should create MusicBrainzSearchTool with default mocks', () => {
            const tool = MusicBrainzSearchFactory.createForTesting({});
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
        });

        it('should accept custom mocks', () => {
            const mockApiClient = {
                search: jest.fn(),
                getDetailedRelease: jest.fn(),
                validateEntity: jest.fn()
            };
            
            const tool = MusicBrainzSearchFactory.createForTesting({
                apiClient: mockApiClient
            });
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
        });

        it('should use provided config', () => {
            const customConfig = new MusicBrainzConfigImpl(
                'https://test.example.com',
                'Test-Agent/1.0'
            );
            
            const tool = MusicBrainzSearchFactory.createForTesting({
                config: customConfig
            });
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
        });
    });

    describe('createSearchTool', () => {
        it('should create MusicBrainzSearchTool directly', () => {
            const tool = MusicBrainzSearchFactory.createSearchTool();
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
        });

        it('should create tool with custom config', () => {
            const customConfig = new MusicBrainzConfigImpl(
                'https://custom.example.com'
            );
            
            const tool = MusicBrainzSearchFactory.createSearchTool(customConfig);
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
        });

        it('should use environment config when no config provided', () => {
            process.env.OPENAI_MODEL = 'gpt-4';
            
            const tool = MusicBrainzSearchFactory.createSearchTool();
            
            expect(tool).toBeInstanceOf(MusicBrainzSearchTool);
            
            delete process.env.OPENAI_MODEL;
        });
    });

    describe('tool functionality', () => {
        it('should be able to call the tool function', async () => {
            // This is an integration test that will use mocked dependencies
            const tool = MusicBrainzSearchFactory.create();
            
            // The actual call would depend on mocked services, but we can test the structure
            expect(typeof tool.func).toBe('function');
            expect(tool.func.length).toBe(1); // Should accept one parameter (input string)
        });
    });

    describe('configuration validation', () => {
        it('should handle missing environment variables gracefully', () => {
            // Clear all MusicBrainz environment variables
            const originalEnv = { ...process.env };
            
            Object.keys(process.env).forEach(key => {
                if (key.startsWith('MUSICBRAINZ_') || key === 'OPENAI_MODEL') {
                    delete process.env[key];
                }
            });
            
            expect(() => {
                MusicBrainzSearchFactory.create();
            }).not.toThrow();
            
            // Restore environment
            process.env = originalEnv;
        });
    });
});