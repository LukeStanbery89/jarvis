console.log('[Background] Background script starting...');
import { websocketManager } from './websocket';
import { ToolExecutor } from './tools/ToolExecutor';
console.log('[Background] WebSocket manager imported successfully');

/**
 * Background script for persistent WebSocket connection
 * 
 * This script runs continuously in the background, maintaining a persistent
 * connection to the server even when the popup is closed. This eliminates
 * the connection churn that was occurring on each popup open/close cycle.
 * 
 * FIXME: Long-term memory management issues to address:
 * - Server-side conversation contexts accumulate indefinitely due to LangGraph 
 *   MemorySaver limitation (cannot clear individual client threads)
 * - Need to implement conversation history cleanup/rotation
 * - Consider implementing session timeout or max conversation length limits
 * - Background script lifecycle during extension updates needs handling
 */

// Track active popup ports for message forwarding
const activePopupPorts = new Set<chrome.runtime.Port>();

// Track initialization state to prevent duplicate connections
let isInitializing = false;

// Tool executor for handling server tool requests
const toolExecutor = new ToolExecutor();

// Initialize WebSocket connection when background script starts
initializeBackgroundConnection();

/**
 * Initialize persistent WebSocket connection
 */
async function initializeBackgroundConnection() {
    // Prevent duplicate initialization
    if (isInitializing || websocketManager.connected) {
        console.log('[Background] Connection already initialized or in progress');
        return;
    }
    
    isInitializing = true;
    
    try {
        console.log('[Background] Initializing persistent WebSocket connection...');
        const connected = await websocketManager.connect();
        
        if (connected) {
            console.log('[Background] ✓ WebSocket connected successfully');
            
            // Set up event listeners for server messages
            setupWebSocketEventListeners();
            
            // Register extension capabilities with server
            registerExtensionCapabilities();
        } else {
            console.warn('[Background] ✗ Failed to connect to WebSocket server');
            // TODO: Implement retry logic with exponential backoff
        }
    } catch (error) {
        console.error('[Background] WebSocket initialization error:', error);
    } finally {
        isInitializing = false;
    }
}

// Track if event listeners have been set up
let eventListenersSetup = false;

/**
 * Set up WebSocket event listeners to forward messages to popup
 */
function setupWebSocketEventListeners() {
    // Prevent duplicate event listener setup
    if (eventListenersSetup) {
        console.log('[Background] Event listeners already set up');
        return;
    }
    
    websocketManager.on('registration_confirmed', (data) => {
        console.log('[Background] Extension registered with server:', data);
        broadcastToPopups('registration_confirmed', data);
    });
    
    websocketManager.on('agent_response', (data) => {
        console.log('[Background] Received agent response:', data);
        broadcastToPopups('agent_response', data);
    });
    
    websocketManager.on('agent_status', (data) => {
        console.log('[Background] Agent status update:', data);
        broadcastToPopups('agent_status', data);
    });
    
    websocketManager.on('error', (error) => {
        console.error('[Background] WebSocket error:', error);
        broadcastToPopups('websocket_error', { error: error.message || 'WebSocket error' });
    });
    
    websocketManager.on('max_reconnect_attempts_reached', () => {
        console.error('[Background] Failed to reconnect to server');
        broadcastToPopups('connection_failed', { message: 'Failed to reconnect to server' });
    });
    
    websocketManager.on('conversation_cleared', (data) => {
        console.log('[Background] Server confirmed conversation cleared:', data);
        broadcastToPopups('conversation_cleared', data);
    });
    
    websocketManager.on('tool_execution_request', async (data) => {
        console.log('[Background] Received tool execution request:', data);
        await handleToolExecutionRequest(data);
    });
    
    websocketManager.on('tool_execution_status', (data) => {
        console.log('[Background] Received tool execution status:', data);
        broadcastToPopups('tool_execution_status', data);
    });

    websocketManager.on('connection_status_changed', (data) => {
        console.log('[Background] Connection status changed:', data.connected ? 'Connected' : 'Disconnected');
        broadcastToPopups('connection_status', data);
    });

    eventListenersSetup = true;
    console.log('[Background] Event listeners set up successfully');
}

/**
 * Register extension capabilities with server
 */
function registerExtensionCapabilities() {
    // The websocketManager already handles registration in its connect() method
    // This is just a placeholder for any additional registration logic
    console.log('[Background] Extension capabilities registered with server');
}

/**
 * Handle tool execution request from server
 */
async function handleToolExecutionRequest(request: any) {
    try {
        console.log('[Background] Executing tool:', request.toolName);
        
        // Execute the tool using ToolExecutor
        const response = await toolExecutor.executeToolRequest(request);
        
        console.log('[Background] Tool execution completed:', response.success);
        
        // Send response back to server via WebSocket
        if (websocketManager.connected) {
            websocketManager.sendMessage('tool_execution_response', response);
        } else {
            console.error('[Background] Cannot send tool response: WebSocket not connected');
        }
        
    } catch (error) {
        console.error('[Background] Tool execution error:', error);
        
        // Send error response to server
        const errorResponse = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'tool_execution_response',
            timestamp: Date.now(),
            executionId: request.executionId,
            success: false,
            error: {
                type: 'unknown',
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: false
            },
            executionTime: 0
        };
        
        if (websocketManager.connected) {
            websocketManager.sendMessage('tool_execution_response', errorResponse);
        }
    }
}

/**
 * Handle connections from popup scripts
 */
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup-background') {
        console.log('[Background] ✓ Popup connected');
        activePopupPorts.add(port);
        
        // Send connection status to newly connected popup
        const status = {
            type: 'connection_status',
            data: {
                connected: websocketManager.connected,
                sessionId: websocketManager.getCurrentSessionId()
            }
        };
        console.log('[Background] → Sending status to popup:', status.data.connected);
        port.postMessage(status);
        
        // Handle messages from popup
        port.onMessage.addListener(async (message) => {
            await handlePopupMessage(message, port);
        });
        
        // Clean up when popup disconnects
        port.onDisconnect.addListener(() => {
            console.log('[Background] ✗ Popup disconnected');
            activePopupPorts.delete(port);
        });
    }
});

/**
 * Handle messages from popup
 */
async function handlePopupMessage(message: any, port: chrome.runtime.Port) {
    try {
        switch (message.type) {
            case 'send_chat_message':
                if (websocketManager.connected) {
                    console.log('[Background] Forwarding chat message to server:', message.content);
                    await websocketManager.sendChatMessage(message.content);
                } else {
                    console.warn('[Background] Cannot send message: WebSocket not connected');
                    port.postMessage({
                        type: 'error',
                        message: 'Not connected to server'
                    });
                }
                break;
                
            case 'clear_session':
                console.log('[Background] Clearing session');
                await websocketManager.clearSession();
                port.postMessage({
                    type: 'session_cleared'
                });
                break;
                
            case 'get_connection_status':
                port.postMessage({
                    type: 'connection_status',
                    data: {
                        connected: websocketManager.connected,
                        sessionId: websocketManager.getCurrentSessionId()
                    }
                });
                break;
                
            case 'reconnect':
                console.log('[Background] Attempting to reconnect...');
                const reconnected = await websocketManager.connect();
                port.postMessage({
                    type: 'connection_status',
                    data: {
                        connected: reconnected,
                        sessionId: websocketManager.getCurrentSessionId()
                    }
                });
                break;
                
            case 'tool_execution_status':
                // Forward tool status updates to server
                if (websocketManager.connected && message.data) {
                    websocketManager.sendMessage('tool_execution_status', message.data);
                }
                break;
                
            default:
                console.warn('[Background] Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('[Background] Error handling popup message:', error);
        port.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Broadcast message to all connected popup ports
 */
function broadcastToPopups(type: string, data: any) {
    const message = { type, data };
    activePopupPorts.forEach(port => {
        try {
            port.postMessage(message);
        } catch (error) {
            console.error('[Background] Error broadcasting to popup:', error);
            // Remove invalid port
            activePopupPorts.delete(port);
        }
    });
}

/**
 * Handle messages from settings page and other extension pages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'server_url_changed') {
        console.log('[Background] Server URL changed to:', message.serverUrl);
        websocketManager.updateServerUrl(message.serverUrl)
            .then(() => {
                console.log('[Background] Successfully updated server URL and reconnected');
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('[Background] Failed to update server URL:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep message channel open for async response
    }
});

/**
 * Handle extension lifecycle events
 */
chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] Extension startup - reinitializing connection');
    initializeBackgroundConnection();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed/updated - initializing connection');
    initializeBackgroundConnection();
});

/**
 * Handle extension shutdown
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('[Background] Extension suspending - cleaning up resources');
    toolExecutor.cleanup();
});

// FIXME: Handle extension updates gracefully
// - Need to preserve session across extension updates
// - Consider implementing session recovery mechanism
// - Handle potential WebSocket disconnection during updates

console.log('[Background] Background script loaded');