/**
 * @jarvis/ws-client
 * WebSocket client with reconnection, heartbeat, and session management
 */

export { WebSocketClient } from './WebSocketClient';
export type {
    IWebSocketClient,
    IWebSocketClientConfig,
    IWebSocketClientDependencies,
    WebSocketClientEvents,
    EventListener
} from './types';
