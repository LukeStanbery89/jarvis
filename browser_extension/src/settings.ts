/**
 * Settings page for configuring J.A.R.V.I.S. extension
 */

const DEFAULT_SERVER_URL = 'ws://127.0.0.1:3000';
const SERVER_URL_KEY = 'jarvis_server_url';

// Get DOM elements
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

/**
 * Load current settings from storage
 */
async function loadSettings(): Promise<void> {
    try {
        const result = await chrome.storage.local.get([SERVER_URL_KEY]);
        const serverUrl = result[SERVER_URL_KEY] || DEFAULT_SERVER_URL;
        serverUrlInput.value = serverUrl;
    } catch (error) {
        console.error('[Settings] Failed to load settings:', error);
        showStatus('Failed to load settings', 'error');
    }
}

/**
 * Save settings to storage
 */
async function saveSettings(): Promise<void> {
    try {
        const serverUrl = serverUrlInput.value.trim();

        // Validate URL format
        if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
            showStatus('Invalid WebSocket URL. Must start with ws:// or wss://', 'error');
            return;
        }

        // Save to storage
        await chrome.storage.local.set({ [SERVER_URL_KEY]: serverUrl });

        // Notify background script to reconnect with new URL
        chrome.runtime.sendMessage({
            type: 'server_url_changed',
            serverUrl
        });

        showStatus('Settings saved successfully!', 'success');

        // Auto-hide success message after 2 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
        showStatus('Failed to save settings', 'error');
    }
}

/**
 * Reset settings to default
 */
async function resetSettings(): Promise<void> {
    try {
        serverUrlInput.value = DEFAULT_SERVER_URL;
        await chrome.storage.local.set({ [SERVER_URL_KEY]: DEFAULT_SERVER_URL });

        // Notify background script to reconnect with default URL
        chrome.runtime.sendMessage({
            type: 'server_url_changed',
            serverUrl: DEFAULT_SERVER_URL
        });

        showStatus('Settings reset to default', 'success');

        // Auto-hide success message after 2 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('[Settings] Failed to reset settings:', error);
        showStatus('Failed to reset settings', 'error');
    }
}

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error'): void {
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'border-green-200', 'bg-red-50', 'text-red-700', 'border-red-200');

    if (type === 'success') {
        statusDiv.classList.add('bg-green-50', 'text-green-700', 'border', 'border-green-200');
    } else {
        statusDiv.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
    }
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
resetBtn.addEventListener('click', resetSettings);

// Allow Enter key to save
serverUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSettings();
    }
});

// Load settings on page load
loadSettings();
