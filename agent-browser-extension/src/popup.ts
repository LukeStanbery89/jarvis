// WebSocket connection now handled by background script
// import { websocketManager } from './websocket';
import { marked } from 'marked';

// Configure marked for security and proper rendering
marked.setOptions({
    breaks: true,        // Convert line breaks to <br>
    gfm: true,          // GitHub Flavored Markdown
    silent: true,       // Don't throw on errors
    async: false        // Use sync parsing
});

document.addEventListener('DOMContentLoaded', function () {
    // Background script connection management (declare first to avoid hoisting issues)
    var backgroundPort: chrome.runtime.Port | null = null;
    var isConnectedToServer = false;

    // Tab elements
    const summarizeTab = document.getElementById('summarizeTab') as HTMLButtonElement;
    const chatTab = document.getElementById('chatTab') as HTMLButtonElement;
    const summarizePanel = document.getElementById('summarizePanel') as HTMLDivElement;
    const chatPanel = document.getElementById('chatPanel') as HTMLDivElement;

    // Summarize elements
    const summarizeBtn = document.getElementById('summarizeBtn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const summaryContainer = document.getElementById('summaryContainer');
    const summaryTitle = document.getElementById('summaryTitle');
    const summary = document.getElementById('summary');
    const status = document.getElementById('status');

    // Chat elements
    const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
    const chatInput = document.getElementById('chatInput') as HTMLInputElement;
    const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
    const agentStatus = document.getElementById('agentStatus') as HTMLDivElement;
    const statusText = document.getElementById('statusText') as HTMLSpanElement;

    // Connection status elements
    const connectionDot = document.getElementById('connectionDot') as HTMLDivElement;
    const chatHeader = document.getElementById('chatHeader') as HTMLHeadingElement;

    // Current active tab
    let activeTab = 'chat';

    // Initialize tab switching
    initializeTabs();

    // Load saved state on popup open
    loadSavedState();

    // Initialize background script communication
    initializeBackgroundConnection();

    // Initialize chat functionality
    initializeChat();

    async function loadSavedState() {
        try {
            const result = await chrome.storage.local.get(['lastSummary']);
            if (result.lastSummary) {
                const savedData = result.lastSummary;
                showSummary(savedData);
            }
        } catch (error) {
            console.error('Failed to load saved state:', error);
        }
    }

    async function saveState(summaryData) {
        try {
            await chrome.storage.local.set({ lastSummary: summaryData });
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    function showLoading() {
        summarizeBtn.disabled = true;
        loading.style.display = 'block';
        error.style.display = 'none';
        summaryContainer.style.display = 'none';
        status.textContent = '';
    }

    function hideLoading() {
        summarizeBtn.disabled = false;
        loading.style.display = 'none';
    }

    function showError(message) {
        hideLoading();
        error.style.display = 'block';
        error.textContent = message;
        summaryContainer.style.display = 'none';
    }

    function showSummary(data) {
        hideLoading();
        error.style.display = 'none';
        summaryContainer.style.display = 'block';
        summaryTitle.textContent = data.title || 'Page Summary';
        summary.textContent = data.summary;
        status.textContent = `Generated at ${new Date(data.timestamp).toLocaleTimeString()}`;

        // Save the summary data for persistence
        saveState(data);
    }

    async function summarizePage() {
        try {
            showLoading();

            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                throw new Error('No active tab found');
            }

            // Execute content script to extract page content
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: extractPageContent
            });

            if (!results || !results[0] || !results[0].result) {
                throw new Error('Failed to extract page content');
            }

            const pageData = results[0].result;

            if (!pageData.content || pageData.content.trim().length === 0) {
                throw new Error('No content found on this page');
            }

            // Update button text based on whether we're summarizing selection or page
            if (pageData.isSelection) {
                status.textContent = 'Summarizing selected text...';
            } else {
                status.textContent = 'Summarizing entire page...';
            }

            // Send to server for summarization
            const response = await fetch('http://127.0.0.1:3000/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: pageData.content,
                    title: pageData.title
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const summaryData = await response.json();
            showSummary(summaryData);

        } catch (err) {
            console.error('Summarization error:', err);
            showError(err.message || 'An unexpected error occurred');
        }
    }

    // This function will be injected into the page context
    function extractPageContent() {
        const title = document.title;

        // Check for selected text first
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0) {
            return {
                title: title,
                content: `SELECTED TEXT: ${selectedText}`,
                url: window.location.href,
                isSelection: true
            };
        }

        // If no selection, extract page content as before
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

                // Skip elements that are not visible
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    el.offsetWidth > 0 &&
                    el.offsetHeight > 0;

                return !isAd && isVisible;
            })
            .map(el => {
                const text = el.textContent.trim();
                if (text.length === 0) return null;

                const tagName = el.tagName.toLowerCase();
                return `${tagName}: ${text}`;
            })
            .filter(item => item !== null)
            .join('\n\n');

        return {
            title: title,
            content: semanticContent.slice(0, 8000), // Limit content length
            url: window.location.href,
            isSelection: false
        };
    }

    /**
     * Send message to background script
     */
    function sendMessageToBackground(type: string, data?: any) {
        if (backgroundPort) {
            backgroundPort.postMessage({ type, ...data });
        } else {
            console.error('[Popup] Cannot send message: not connected to background script');
        }
    }

    /**
     * Handle messages from background script
     */
    function updateConnectionStatus(connected: boolean) {
        isConnectedToServer = connected;

        if (connected) {
            connectionDot.className = 'w-2 h-2 rounded-full bg-green-500 transition-colors';
            chatHeader.textContent = 'Connected';
        } else {
            connectionDot.className = 'w-2 h-2 rounded-full bg-red-500 transition-colors';
            chatHeader.textContent = 'Disconnected';
        }

        console.log('[Popup] ← Connection status updated:', connected ? '✓ Connected' : '✗ Disconnected');
    }

    function handleBackgroundMessage(message: any) {
        switch (message.type) {
            case 'connection_status':
                updateConnectionStatus(message.data.connected);
                break;

            case 'registration_confirmed':
                console.log('[Popup] Extension registered with server:', message.data);
                break;

            case 'agent_response':
                console.log('[Popup] Received agent response:', message.data);
                if (activeTab === 'chat') {
                    addMessageToChat('assistant', message.data.content);
                    hideAgentStatus();
                    sendButton.disabled = false;
                    chatInput.disabled = false;
                    chatInput.focus();
                }
                break;

            case 'agent_status':
                console.log('[Popup] Agent status:', message.data);
                if (activeTab === 'chat') {
                    const data = message.data;
                    if (data.status === 'thinking') {
                        showAgentStatus(data.message || 'Thinking...');
                    } else if (data.status === 'complete') {
                        hideAgentStatus();
                        sendButton.disabled = false;
                        chatInput.disabled = false;
                        chatInput.focus();
                    } else if (data.status === 'error') {
                        addMessageToChat('system', `Error: ${data.message || 'Something went wrong'}`);
                        hideAgentStatus();
                        sendButton.disabled = false;
                        chatInput.disabled = false;
                    }
                }
                break;

            case 'tool_execution_status':
                console.log('[Popup] Tool execution status:', message.data);
                if (activeTab === 'chat') {
                    const data = message.data;
                    if (data.status === 'executing' && data.statusMessage) {
                        showAgentStatus(data.statusMessage);
                    } else if (data.status === 'completed') {
                        // Status will be updated by agent completion or next agent status
                        // Don't hide status immediately as agent might still be processing
                    }
                }
                break;

            case 'session_cleared':
                console.log('[Popup] Session cleared by background script');
                break;

            case 'conversation_cleared':
                console.log('[Popup] Server confirmed conversation cleared:', message.data);
                // Could add a brief success message to the UI if desired
                break;

            case 'websocket_error':
            case 'connection_failed':
                console.error('[Popup] Background script error:', message);
                addMessageToChat('system', `Connection error: ${message.error || message.message}`);
                break;

            case 'error':
                console.error('[Popup] Background script error:', message.message);
                addMessageToChat('system', `Error: ${message.message}`);
                break;

            default:
                console.warn('[Popup] Unknown message type:', message.type);
        }
    }

    /**
     * Initialize connection to background script
     * FIXME: Add connection health monitoring and automatic reconnection
     * FIXME: Handle background script restart scenarios gracefully
     */
    function initializeBackgroundConnection() {
        try {
            console.log('[Popup] → Connecting to background script...');
            backgroundPort = chrome.runtime.connect({ name: 'popup-background' });

            // Handle messages from background script
            backgroundPort.onMessage.addListener((message) => {
                handleBackgroundMessage(message);
            });

            // Handle disconnection
            backgroundPort.onDisconnect.addListener(() => {
                console.warn('[Popup] ✗ Disconnected from background script');
                backgroundPort = null;
                isConnectedToServer = false;
                // Try to reconnect after a short delay
                setTimeout(() => {
                    if (!backgroundPort) {
                        initializeBackgroundConnection();
                    }
                }, 1000);
            });

            // Request initial connection status
            console.log('[Popup] → Requesting connection status...');
            sendMessageToBackground('get_connection_status');

        } catch (error) {
            console.error('[Popup] Background connection error:', error);
        }
    }

    // Event listeners
    summarizeBtn.addEventListener('click', summarizePage);

    function initializeTabs() {
        summarizeTab.addEventListener('click', () => switchTab('summarize'));
        chatTab.addEventListener('click', () => switchTab('chat'));

        // Set initial tab
        switchTab('chat');
    }

    function switchTab(tab: 'summarize' | 'chat') {
        activeTab = tab;

        // Update tab styling
        if (tab === 'summarize') {
            summarizeTab.className = 'flex-1 py-2 px-4 text-sm font-medium text-primary-600 border-b-2 border-primary-500';
            chatTab.className = 'flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700';

            // Show/hide panels
            summarizePanel.style.display = 'block';
            chatPanel.style.display = 'none';
        } else {
            chatTab.className = 'flex-1 py-2 px-4 text-sm font-medium text-primary-600 border-b-2 border-primary-500';
            summarizeTab.className = 'flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700';

            // Show/hide panels
            summarizePanel.style.display = 'none';
            chatPanel.style.display = 'flex';
            chatPanel.className = 'flex flex-col h-[30rem]'; // Set height for chat panel
        }
    }

    function initializeChat() {
        // Send message on button click
        sendButton.addEventListener('click', sendChatMessage);

        // Send message on Enter key
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // Add clear conversation button listener
        const clearConversationBtn = document.getElementById('clearConversationBtn') as HTMLButtonElement;
        if (clearConversationBtn) {
            clearConversationBtn.addEventListener('click', clearConversation);
        }

        // Load saved chat history
        loadChatHistory();
    }

    async function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Clear input
        chatInput.value = '';

        // Add user message to chat
        addMessageToChat('user', message);

        // Show agent thinking status
        showAgentStatus('Thinking...');

        // Disable send button
        sendButton.disabled = true;
        chatInput.disabled = true;

        try {
            // Send message via background script
            if (backgroundPort && isConnectedToServer) {
                sendMessageToBackground('send_chat_message', { content: message });
            } else {
                throw new Error('Not connected to chat server');
            }
        } catch (error) {
            console.error('[Popup] Error sending chat message:', error);
            addMessageToChat('system', 'Error: Could not send message. Please check your connection.');
            hideAgentStatus();
            sendButton.disabled = false;
            chatInput.disabled = false;
        }
    }

    function addMessageToChat(role: 'user' | 'assistant' | 'system', content: string) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        // Store the original content as a data attribute for persistence
        messageDiv.setAttribute('data-original-content', content);
        messageDiv.setAttribute('data-role', role);

        if (role === 'user') {
            messageDiv.className = 'flex justify-end';
            messageDiv.innerHTML = `
                <div class="primary-gradient text-white px-3 py-2 rounded-lg max-w-xs break-words">
                    ${escapeHtml(content)}
                </div>
            `;
        } else if (role === 'assistant') {
            messageDiv.className = 'flex justify-start';
            messageDiv.innerHTML = `
                <div class="bg-gray-100 text-gray-900 px-3 py-2 rounded-lg max-w-xs break-words markdown-content">
                    ${parseMarkdownSafely(content)}
                </div>
            `;
        } else { // system
            messageDiv.className = 'flex justify-center';
            messageDiv.innerHTML = `
                <div class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm italic">
                    ${escapeHtml(content)}
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save chat history
        saveChatHistory();
    }

    function showAgentStatus(message: string) {
        statusText.textContent = message;
        agentStatus.style.display = 'block';
        // Auto-scroll to bottom to ensure status is visible
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideAgentStatus() {
        agentStatus.style.display = 'none';
        // Auto-scroll to bottom after hiding status to show latest content
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function parseMarkdownSafely(text: string): string {
        try {
            // Parse markdown to HTML
            const html = marked.parse(text) as string;

            // Basic sanitization - remove script tags and dangerous attributes
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        } catch (error) {
            console.error('Markdown parsing error:', error);
            // Fallback to escaped HTML if parsing fails
            return escapeHtml(text);
        }
    }

    async function loadChatHistory() {
        try {
            const result = await chrome.storage.local.get(['chatHistory']);
            if (result.chatHistory && Array.isArray(result.chatHistory)) {
                result.chatHistory.forEach((msg: any) => {
                    addMessageToChat(msg.role, msg.content);
                });
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }

    async function saveChatHistory() {
        try {
            const messages = Array.from(chatMessages.children).map(msgDiv => {
                const element = msgDiv as HTMLElement;
                const role = element.getAttribute('data-role') ||
                    (msgDiv.classList.contains('justify-end') ? 'user' :
                        msgDiv.classList.contains('justify-start') ? 'assistant' : 'system');
                const content = element.getAttribute('data-original-content') || element.textContent || '';
                return { role, content };
            });

            // Keep only last 50 messages to avoid storage bloat
            const recentMessages = messages.slice(-50);
            await chrome.storage.local.set({ chatHistory: recentMessages });
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }

    async function clearConversation() {
        try {
            // Clear session via background script
            sendMessageToBackground('clear_session');

            // Clear chat messages from UI
            chatMessages.innerHTML = '';

            // Clear chat history from storage
            await chrome.storage.local.remove(['chatHistory']);

            console.log('[Popup] Conversation cleared');
        } catch (error) {
            console.error('[Popup] Failed to clear conversation:', error);
        }
    }
});