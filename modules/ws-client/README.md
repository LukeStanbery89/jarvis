# @jarvis/ws-client

A robust, platform-agnostic WebSocket client library with automatic reconnection, session management, and health monitoring. Designed for real-time communication in both browser and Node.js environments.

## Features

- **Automatic Reconnection**: Handles connection drops with exponential backoff
- **Session Management**: Persistent session IDs with local storage integration
- **Health Monitoring**: Built-in ping/pong for connection health checks
- **Event-Driven Architecture**: Clean event system for handling server messages
- **Platform Agnostic**: Works in browsers, Node.js, and other JavaScript environments
- **TypeScript Support**: Full TypeScript definitions included
- **Tool Execution**: Built-in support for client-server tool execution workflows

## Installation

```bash
npm install @jarvis/ws-client
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @jarvis/protocol @jarvis/device-identity
```

## Quick Start

```typescript
import { WebSocketClient } from '@jarvis/ws-client';
import { DeviceIdentity, BrowserStorageAdapter, BrowserIdGenerator } from '@jarvis/device-identity/browser';

// Initialize device identity
const deviceIdentity = new DeviceIdentity(
    'my-app',
    new BrowserStorageAdapter(),
    new BrowserIdGenerator(),
    ['chat', 'file_upload'] // capabilities
);

// Create WebSocket client
const wsClient = new WebSocketClient(
    {
        deviceIdentity: await deviceIdentity.getIdentity(),
        storage: new BrowserStorageAdapter(),
        capabilities: ['chat', 'file_upload']
    },
    {
        serverUrl: 'ws://localhost:3000',
        maxReconnectAttempts: 5,
        autoConnect: true
    }
);

// Listen for events
wsClient.on('agent_response', (data) => {
    console.log('Received agent response:', data);
});

wsClient.on('connection_status_changed', ({ connected }) => {
    console.log('Connection status:', connected ? 'connected' : 'disconnected');
});

// Send a chat message
await wsClient.sendChatMessage('Hello, agent!');
```

## API Reference

### WebSocketClient

#### Constructor

```typescript
new WebSocketClient(
    dependencies: IWebSocketClientDependencies,
    config?: IWebSocketClientConfig
)
```

**Parameters:**
- `dependencies`: Required dependencies (device identity, storage, capabilities)
- `config`: Optional configuration

#### Configuration Options

```typescript
interface IWebSocketClientConfig {
    serverUrl?: string;                    // Default: 'ws://127.0.0.1:3000'
    maxReconnectAttempts?: number;         // Default: 5
    reconnectDelay?: number;               // Default: 1000ms
    connectedPollInterval?: number;        // Default: 30000ms (30s)
    disconnectedPollInterval?: number;     // Default: 5000ms (5s)
    autoConnect?: boolean;                 // Default: false
}
```

#### Core Methods

##### Connection Management

```typescript
// Connect to server
await wsClient.connect(): Promise<boolean>

// Disconnect from server
wsClient.disconnect(): void

// Check connection status
wsClient.connected: boolean
```

##### Messaging

```typescript
// Send chat message (auto-creates session if needed)
await wsClient.sendChatMessage(content: string): Promise<void>

// Send arbitrary message
wsClient.sendMessage(eventName: string, data: any): void
```

##### Session Management

```typescript
// Create new session
await wsClient.createNewSession(): Promise<void>

// Clear current session
await wsClient.clearSession(): Promise<void>

// Get current session ID
wsClient.getCurrentSessionId(): string | null
```

##### Event Handling

```typescript
// Register event listener
wsClient.on(event: string, listener: EventListener): void

// Remove event listener
wsClient.off(event: string, listener?: EventListener): void
```

#### Events

The client emits the following events:

- `connection_status_changed`: Fired when connection status changes
- `registration_confirmed`: Server confirmed client registration
- `agent_response`: Received agent response message
- `agent_status`: Agent status update
- `conversation_cleared`: Server confirmed conversation cleared
- `tool_execution_request`: Server requested tool execution
- `tool_execution_status`: Tool execution status update
- `error`: WebSocket error occurred
- `max_reconnect_attempts_reached`: Failed to reconnect after max attempts

## Dependencies Interface

```typescript
interface IWebSocketClientDependencies {
    deviceIdentity: IDeviceIdentity;    // Client identity for registration
    storage: IStorageAdapter;           // Persistent storage for sessions
    capabilities: string[];             // List of client capabilities
}
```

## Browser Usage

For browser environments, use the browser-specific device identity adapters:

```typescript
import { DeviceIdentity, BrowserStorageAdapter, BrowserIdGenerator } from '@jarvis/device-identity/browser';
```

## Node.js Usage

For Node.js environments, use the Node.js-specific adapters:

```typescript
import { DeviceIdentity, NodeStorageAdapter, NodeIdGenerator } from '@jarvis/device-identity/node';
```

## Testing

```bash
npm test
npm run test:coverage
```

The package includes comprehensive tests covering:
- Connection lifecycle management
- Automatic reconnection logic
- Session persistence
- Message handling
- Event system
- Memory management

## License

ISC