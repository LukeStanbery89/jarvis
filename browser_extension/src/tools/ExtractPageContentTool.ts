import { BaseToolExecutor } from './BaseToolExecutor';
import { ToolExecutionRequest, ToolExecutionResponse } from '@jarvis/protocol';
import { logger } from '../utils/logger';

/**
 * Tool for extracting content from the current web page
 * 
 * Capabilities:
 * - Extract selected text if user has made a selection
 * - Fall back to semantic page content extraction
 * - Filter out advertisements and hidden content
 * - Return structured content with title, url, and content type
 * - Limit content to 8000 characters for API efficiency
 */

export interface PageContentResult {
    title: string;
    content: string;
    url: string;
    isSelection: boolean;
}

export class ExtractPageContentTool extends BaseToolExecutor {
    readonly toolName = 'extract_page_content';

    async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
        logger.verbose('Executing page content extraction', {
            service: 'ExtractPageContentTool',
            executionId: request.executionId,
            url: window.location.href
        });

        const startTime = Date.now();

        try {
            // Extract page content using enhanced logic
            const pageData = await this.extractPageContent();
            
            const executionTime = Date.now() - startTime;
            
            logger.info('Page content extraction completed', {
                service: 'ExtractPageContentTool',
                executionId: request.executionId,
                contentLength: pageData.content.length,
                isSelection: pageData.isSelection,
                executionTime
            });

            return this.createSuccessResponse(request, pageData, executionTime);
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            logger.error('Page content extraction failed', {
                service: 'ExtractPageContentTool',
                executionId: request.executionId,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime
            });

            return this.createErrorResponse(
                request, 
                'browser_api', 
                `Failed to extract page content: ${error instanceof Error ? error.message : 'Unknown error'}`,
                false,
                executionTime
            );
        }
    }

    /**
     * Extract page content with selection detection and semantic parsing
     */
    private async extractPageContent(): Promise<PageContentResult> {
        const title = document.title;

        // Check for selected text first
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        
        if (selectedText && selectedText.length > 0) {
            logger.debug('Using selected text for content extraction', {
                service: 'ExtractPageContentTool',
                selectionLength: selectedText.length
            });
            
            return {
                title: title,
                content: `SELECTED TEXT: ${selectedText}`,
                url: window.location.href,
                isSelection: true
            };
        }

        // If no selection, extract semantic page content
        logger.debug('Extracting full page content', {
            service: 'ExtractPageContentTool',
            url: window.location.href
        });

        // Try to find main content area with common semantic elements
        const mainContent = document.querySelector('main') ||
            document.querySelector('article') ||
            document.querySelector('[role="main"]') ||
            document.body;

        if (!mainContent) {
            throw new Error('Could not find main content area on page');
        }

        // Whitelist of content elements we want to extract (no DOM modification)
        const contentSelectors = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';
        const textElements = mainContent.querySelectorAll(contentSelectors);

        const semanticContent = Array.from(textElements)
            .filter(el => this.isValidContentElement(el))
            .map(el => {
                const text = el.textContent?.trim() || '';
                if (text.length === 0) return null;

                const tagName = el.tagName.toLowerCase();
                return `${tagName}: ${text}`;
            })
            .filter(item => item !== null)
            .join('\n\n');

        if (!semanticContent || semanticContent.trim().length === 0) {
            throw new Error('No readable content found on page');
        }

        return {
            title: title,
            content: semanticContent.slice(0, 8000), // Limit content length for API efficiency
            url: window.location.href,
            isSelection: false
        };
    }

    /**
     * Check if an element contains valid content
     */
    private isValidContentElement(el: Element): boolean {
        // Skip elements that are likely ads or unwanted content
        const classList = el.className.toLowerCase();
        const id = el.id.toLowerCase();
        const isAd = classList.includes('ad') || 
                    classList.includes('advertisement') ||
                    classList.includes('sponsored') || 
                    classList.includes('promo') ||
                    id.includes('ad') || 
                    id.includes('ads');

        if (isAd) return false;

        // Skip elements that are not visible
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0;

        return isVisible;
    }

    /**
     * Get tool definition for server registration
     */
    static getToolDefinition() {
        return {
            name: 'extract_page_content',
            description: 'Extract content from the current web page, prioritizing selected text if available',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        };
    }
}