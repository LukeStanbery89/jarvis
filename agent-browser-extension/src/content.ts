// Content script for the Agentic Page Summarizer extension
// This script runs in the context of web pages

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
        try {
            const pageData = extractPageContent();
            sendResponse({ success: true, data: pageData });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    return true; // Will respond asynchronously
});

function extractPageContent() {
    const title = document.title;

    // Try to find main content area with common semantic elements
    let mainContent = document.querySelector('main') ||
        document.querySelector('article') ||
        document.querySelector('[role="main"]') ||
        document.body;

    // Whitelist of content elements we want to extract (no DOM modification)
    const contentSelectors = 'h1, h2, h3, h4, h5, h6, p, li, blockquote';
    const textElements = mainContent.querySelectorAll(contentSelectors);
    
    const semanticContent = Array.from(textElements)
        .filter(el => {
            // Skip elements that are likely ads or unwanted content
            const classList = el.className.toLowerCase();
            const id = el.id.toLowerCase();
            const isAd = classList.includes('ad') || classList.includes('advertisement') || 
                       classList.includes('sponsored') || classList.includes('promo') ||
                       id.includes('ad') || id.includes('ads');
            return !isAd;
        })
        .map(el => {
            const text = el.textContent.trim();
            if (text.length === 0) return null;

            const tagName = el.tagName.toLowerCase();
            return `${tagName.toUpperCase()}: ${text}`;
        })
        .filter(item => item !== null)
        .join('\n\n');

    return {
        title: title,
        content: semanticContent.slice(0, 8000), // Limit content length
        url: window.location.href
    };
}