import SerperWebSearch from '../../src/serper/SerperWebSearch';
import { Serper } from "@langchain/community/tools/serper";

describe('SerperWebSearch', () => {
    describe('exported instance', () => {
        it('should be defined', () => {
            expect(SerperWebSearch).toBeDefined();
        });

        it('should be an instance of Serper', () => {
            expect(SerperWebSearch).toBeInstanceOf(Serper);
        });

        it('should have the correct description', () => {
            expect(SerperWebSearch.description).toBe(
                "Web search using Serper API. First 2,500 queries are free. Subsequent queries require credits. Prefer a free web search tool over this one, if possible."
            );
        });

        it('should have description containing key information', () => {
            expect(SerperWebSearch.description).toContain('Web search using Serper API');
            expect(SerperWebSearch.description).toContain('First 2,500 queries are free');
            expect(SerperWebSearch.description).toContain('Prefer a free web search tool');
        });
    });

    describe('configuration', () => {
        it('should have inherited Serper properties', () => {
            expect(typeof SerperWebSearch).toBe('object');
            expect(SerperWebSearch.description).toBeTruthy();
        });
    });
});
