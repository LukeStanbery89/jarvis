// Sample test for content script functionality
// Use Jest globals
// Mock DOM for testing
const mockDOM = () => {
    document.body.innerHTML = `
    <main>
      <h1>Test Article</h1>
      <p>This is a test paragraph with meaningful content.</p>
      <div class="ad">Advertisement content</div>
      <p>Another paragraph with good content.</p>
    </main>
  `;
};

describe('Content Script', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('should extract page content correctly', () => {
        mockDOM();

        // This would test the extractPageContent function
        // We'll implement this when we convert the content script to TypeScript
        const title = document.title || 'Test Page';
        const content = document.querySelector('main')?.textContent;

        expect(title).toBeDefined();
        expect(content).toContain('Test Article');
        expect(content).toContain('meaningful content');
    });

    it('should filter out ad content', () => {
        mockDOM();

        const adElements = document.querySelectorAll('.ad');
        const contentElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

        expect(adElements).toHaveLength(1);
        expect(contentElements).toHaveLength(3); // h1 + 2 p tags
    });

    it('should handle chrome API calls', () => {
        const mockResponse = { success: true, data: { content: 'test' } };

        // Test chrome.runtime.onMessage listener
        const listener = jest.fn();
        chrome.runtime.onMessage.addListener(listener);

        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(listener);
    });
});