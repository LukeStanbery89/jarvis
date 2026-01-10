import { IFallbackSearchStrategy, SearchResult } from '../interfaces/IMusicBrainzServices';

/**
 * Strategy for handling fallback searches when initial queries return no results
 */
export class StandardFallbackStrategy implements IFallbackSearchStrategy {
    shouldAttemptFallback(originalResult: SearchResult, query: string): boolean {
        // Check if we have no results and this was a complex query
        const hasNoResults = this.countResults(originalResult) === 0;
        const isComplexQuery = query.includes('AND') || query.includes('OR');
        
        return hasNoResults && isComplexQuery;
    }

    createFallbackQuery(originalQuery: string, entity: string): string {
        // Extract just the main search term for fallback
        const mainTerm = this.extractMainTerm(originalQuery, entity);
        
        if (mainTerm) {
            return `${entity}:"${mainTerm}"`;
        }
        
        // If we can't extract a main term, try simpler approach
        const firstPart = originalQuery.split(' AND ')[0].trim();
        if (firstPart.includes(':')) {
            return firstPart;
        } else {
            return `${entity}:${firstPart}`;
        }
    }

    private countResults(result: SearchResult): number {
        // Count total results across all entity types
        let totalResults = 0;
        for (const key in result) {
            if (Array.isArray(result[key])) {
                totalResults += result[key].length;
            }
        }
        return totalResults;
    }

    private extractMainTerm(query: string, entity: string): string | null {
        // Look for quoted terms in the format entity:"term"
        const quotedMatch = query.match(new RegExp(`${entity}:"([^"]+)"`));
        if (quotedMatch) {
            return quotedMatch[1];
        }

        // Look for unquoted terms in the format entity:term
        const unquotedMatch = query.match(new RegExp(`${entity}:([^\\s]+)`));
        if (unquotedMatch) {
            return unquotedMatch[1];
        }

        // Fall back to release:"term" if we're looking for releases
        if (entity === 'release') {
            const releaseMatch = query.match(/release:"([^"]+)"/);
            if (releaseMatch) {
                return releaseMatch[1];
            }
        }

        return null;
    }
}