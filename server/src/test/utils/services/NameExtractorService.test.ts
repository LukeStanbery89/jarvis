import { NameExtractorService } from '../../../utils/services/NameExtractorService';
import { Serialized } from '@langchain/core/load/serializable';

describe('NameExtractorService', () => {
    let service: NameExtractorService;

    beforeEach(() => {
        service = new NameExtractorService();
    });

    describe('extractName', () => {
        it('should extract name from direct name property', () => {
            const serialized = {
                name: 'TestTool'
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('TestTool');
        });

        it('should extract name from id array', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain', 'tools', 'WebSearchTool']
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('WebSearchTool');
        });

        it('should extract name from kwargs.name', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['test'],
                kwargs: {
                    name: 'CustomTool'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('test');
        });

        it('should extract name from kwargs.model_name', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    model_name: 'gpt-4'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('gpt-4');
        });

        it('should extract name from kwargs.modelName', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    modelName: 'claude-3'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('claude-3');
        });

        it('should extract name from kwargs.model', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    model: 'llama-2'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('llama-2');
        });

        it('should extract name from lc.type', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {}
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('constructor');
        });

        it('should return unknown for empty serialized object', () => {
            const serialized = {} as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('unknown');
        });

        it('should prioritize name property over other properties', () => {
            const serialized = {
                name: 'DirectName',
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain', 'tools', 'OtherTool'],
                kwargs: {
                    name: 'KwargsName',
                    model: 'ModelName'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('DirectName');
        });

        it('should prioritize id array over kwargs', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain', 'tools', 'IdTool'],
                kwargs: {
                    name: 'KwargsName',
                    model: 'ModelName'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('IdTool');
        });

        it('should handle empty id array', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    name: 'KwargsName'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('KwargsName');
        });

        it('should handle non-string elements in id array', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain', 123 as any, null as any],
                kwargs: {
                    name: 'KwargsName'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('KwargsName');
        });

        it('should handle kwargs with null values', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    name: null,
                    model_name: undefined,
                    modelName: '',
                    model: 'ValidModel'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('ValidModel');
        });
    });

    describe('extractToolName', () => {
        it('should delegate to extractName', () => {
            const serialized = {
                name: 'WebSearchTool'
            } as Serialized;

            const result = service.extractToolName(serialized);
            expect(result).toBe('WebSearchTool');
        });
    });

    describe('extractLLMName', () => {
        it('should delegate to extractName', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: [],
                kwargs: {
                    model_name: 'gpt-4-turbo'
                }
            } as Serialized;

            const result = service.extractLLMName(serialized);
            expect(result).toBe('gpt-4-turbo');
        });
    });

    describe('complex extraction scenarios', () => {
        it('should handle LangChain tool serialization format', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain', 'tools', 'tavily_search', 'TavilySearchResults'],
                kwargs: {
                    name: 'tavily_search_results_json',
                    description: 'A search engine'
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('TavilySearchResults');
        });

        it('should handle LangChain LLM serialization format', () => {
            const serialized = {
                lc: 1,
                type: 'constructor' as const,
                id: ['langchain_openai', 'llms', 'openai', 'OpenAI'],
                kwargs: {
                    model_name: 'gpt-3.5-turbo-instruct',
                    temperature: 0.7
                }
            } as Serialized;

            const result = service.extractName(serialized);
            expect(result).toBe('OpenAI');
        });
    });
});