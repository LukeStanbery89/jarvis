import { ExtractPageContentTool } from '../src/ExtractPageContentTool';
import { ToolExecutionRequest } from '@jarvis/protocol';
import { createTestRequest } from './test-utils';

describe('ExtractPageContentTool', () => {
    let tool: ExtractPageContentTool;

    beforeEach(() => {
        tool = new ExtractPageContentTool();
        document.body.innerHTML = '';
        jest.clearAllMocks();

        // Reset window.getSelection mock
        (window.getSelection as jest.Mock).mockReturnValue({
            toString: jest.fn().mockReturnValue(''),
            rangeCount: 0,
        });

        // Mock offsetWidth/offsetHeight for visibility checks (jsdom defaults to 0)
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 100,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            value: 100,
        });
    });

    describe('Basic functionality', () => {
        it('should have correct tool name', () => {
            expect(tool.toolName).toBe('extract_page_content');
        });

        it('should provide tool definition', () => {
            const definition = ExtractPageContentTool.getToolDefinition();
            expect(definition.name).toBe('extract_page_content');
            expect(definition.description).toBeTruthy();
            expect(definition.parameters).toBeDefined();
        });
    });

    describe('Content extraction', () => {
        it('should extract semantic page content', async () => {
            // Setup DOM
            document.body.innerHTML = `
                <main>
                    <h1>Test Article</h1>
                    <p>This is a test paragraph with meaningful content.</p>
                    <h2>Section Header</h2>
                    <p>Another paragraph with good content.</p>
                    <ul>
                        <li>List item 1</li>
                        <li>List item 2</li>
                    </ul>
                </main>
            `;

            const request = createTestRequest({
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            });

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result).toBeDefined();
            expect(response.result.title).toBe('Test Page');
            expect(response.result.url).toBe('https://example.com/test');
            expect(response.result.isSelection).toBe(false);
            expect(response.result.content).toContain('Test Article');
            expect(response.result.content).toContain('meaningful content');
            expect(response.result.content).toContain('Section Header');
        });

        it('should prioritize selected text over full page content', async () => {
            // Setup DOM
            document.body.innerHTML = `
                <main>
                    <h1>Test Article</h1>
                    <p>Full page content</p>
                </main>
            `;

            // Mock selection
            const selectedText = 'User selected this specific text';
            (window.getSelection as jest.Mock).mockReturnValue({
                toString: jest.fn().mockReturnValue(selectedText),
                rangeCount: 1,
            });

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.isSelection).toBe(true);
            expect(response.result.content).toContain('SELECTED TEXT:');
            expect(response.result.content).toContain(selectedText);
            expect(response.result.content).not.toContain('Full page content');
        });

        it('should filter out ad content', async () => {
            // Setup DOM with ads
            document.body.innerHTML = `
                <main>
                    <h1>Test Article</h1>
                    <p>Real content</p>
                    <div class="advertisement">Ad content</div>
                    <div id="ad-banner">Banner ad</div>
                    <p class="sponsored">Sponsored content</p>
                    <p>More real content</p>
                </main>
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('Real content');
            expect(response.result.content).toContain('More real content');
            expect(response.result.content).not.toContain('Ad content');
            expect(response.result.content).not.toContain('Banner ad');
            expect(response.result.content).not.toContain('Sponsored content');
        });

        it('should limit content to 8000 characters', async () => {
            // Create very long content
            const longParagraph = 'a'.repeat(10000);
            document.body.innerHTML = `
                <main>
                    <p>${longParagraph}</p>
                </main>
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content.length).toBeLessThanOrEqual(8000);
        });

        it('should handle article elements', async () => {
            document.body.innerHTML = `
                <article>
                    <h1>Article Title</h1>
                    <p>Article content</p>
                </article>
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('Article Title');
            expect(response.result.content).toContain('Article content');
        });
    });

    describe('Error handling', () => {
        it('should handle empty page', async () => {
            document.body.innerHTML = '<div></div>';

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error?.message).toContain('No readable content');
        });

        it('should return execution time', async () => {
            document.body.innerHTML = '<main><p>Content</p></main>';

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.executionTime).toBeGreaterThanOrEqual(0);
        });

        it('should handle malformed HTML gracefully', async () => {
            // Test with unclosed tags and malformed structure
            document.body.innerHTML = `
                <div>
                    <p>Valid content
                    <span>Unclosed span
                        <strong>Bold text</strong>
                    <p>Another paragraph
                </div>
                <h1>Header without closing
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('Valid content');
            expect(response.result.content).toContain('Bold text');
            expect(response.result.content).toContain('Another paragraph');
        });

        it('should extract content from deeply nested elements', async () => {
            document.body.innerHTML = `
                <div>
                    <section>
                        <article>
                            <div class="content-wrapper">
                                <div class="inner-content">
                                    <p>Deeply nested content</p>
                                    <p>Even deeper content</p>
                                </div>
                            </div>
                        </article>
                    </section>
                </div>
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('p: Deeply nested content');
            expect(response.result.content).toContain('p: Even deeper content');
        });

        it('should extract content from blockquote elements', async () => {
            document.body.innerHTML = `
                <main>
                    <p>Content before quote</p>
                    <blockquote>
                        This is an important quote that should be extracted.
                    </blockquote>
                    <p>Content after quote</p>
                </main>
            `;

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('p: Content before quote');
            expect(response.result.content).toContain('blockquote: This is an important quote that should be extracted.');
            expect(response.result.content).toContain('p: Content after quote');
        });

        it('should skip invisible content', async () => {
            document.body.innerHTML = `
                <main>
                    <p>Visible content</p>
                    <div style="display: none;">Hidden content</div>
                    <p style="visibility: hidden;">Invisible content</p>
                    <div style="opacity: 0;">Transparent content</div>
                    <p>More visible content</p>
                </main>
            `;

            // Mock getComputedStyle to return appropriate visibility values
            (window.getComputedStyle as jest.Mock).mockImplementation((element) => {
                if (element.textContent?.includes('Hidden content')) {
                    return { display: 'none', visibility: 'visible', opacity: '1' };
                }
                if (element.textContent?.includes('Invisible content')) {
                    return { display: 'block', visibility: 'hidden', opacity: '1' };
                }
                if (element.textContent?.includes('Transparent content')) {
                    return { display: 'block', visibility: 'visible', opacity: '0' };
                }
                return { display: 'block', visibility: 'visible', opacity: '1' };
            });

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(true);
            expect(response.result.content).toContain('Visible content');
            expect(response.result.content).toContain('More visible content');
            expect(response.result.content).not.toContain('Hidden content');
            expect(response.result.content).not.toContain('Invisible content');
            expect(response.result.content).not.toContain('Transparent content');
        });

        it('should handle pages with no visible elements', async () => {
            document.body.innerHTML = `
                <div style="display: none;">Hidden 1</div>
                <div style="visibility: hidden;">Hidden 2</div>
                <div style="opacity: 0;">Hidden 3</div>
            `;

            // Mock all elements as invisible
            (window.getComputedStyle as jest.Mock).mockReturnValue({
                display: 'none',
                visibility: 'hidden',
                opacity: '0',
            });

            const request: ToolExecutionRequest = {
                id: 'msg_123',
                type: 'tool_execution_request',
                timestamp: Date.now(),
                executionId: 'exec_123',
                toolName: 'extract_page_content',
                parameters: {},
                timeout: 5000,
            };

            const response = await tool.execute(request);

            expect(response.success).toBe(false);
            expect(response.error?.message).toContain('No readable content');
        });


    });
});
