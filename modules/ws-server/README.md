# @jarvis/ws-server

A robust, platform-agnostic WebSocket server built on the `ws` library with advanced client management, message routing, and extensible handler architecture. Designed for real-time communication between diverse client types including browser extensions, IoT devices, and CLI applications.

## Features

- **Multi-Client Support**: Handles various client types (browser extensions, Raspberry Pi, hardware, CLI)
- **Event-Driven Architecture**: Extensible handler system for processing different message types
- **Client Management**: Advanced client registration, tracking, and lifecycle management
- **Broadcasting**: Targeted message broadcasting by client type or capability
- **Authentication**: Built-in user authentication and permission system
- **Connection Monitoring**: Real-time statistics and health monitoring
- **Rate Limiting**: Built-in protection against abuse
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Platform Agnostic**: Works with any HTTP server (Express, Node.js HTTP, etc.)
- **Logging**: Injectable logger interface for custom logging solutions

## Installation

```bash
npm install @jarvis/ws-server
```

### Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @jarvis/protocol ws
```

## Quick Start

```typescript
import { WebSocketServer, BaseHandler } from '@jarvis/ws-server';
import { createServer } from 'http';
import { parse } from 'url';

// Create HTTP server
const httpServer = createServer();

// Initialize WebSocket server
const wss = new WebSocketServer(httpServer, {
    path: '/ws',
    maxConnections: 100,
    pingInterval: 30000,
    clientTimeout: 60000
});

// Create custom handler
class ChatHandler extends BaseHandler {
    readonly eventName = 'chat_message';

    async handle(socket, data, context) {
        console.log(`Received chat from ${context.clientId}:`, data.message);

        // Broadcast to all clients with chat capability
        wss.broadcastToCapability('chat', 'chat_broadcast', {
            from: context.clientId,
            message: data.message
        });
    }
}

// Register handler
wss.registerHandler(new ChatHandler(wss.clientManager));

// Start server
httpServer.listen(3000, () => {
    console.log('WebSocket server running on port 3000');
});
```

## Architecture

The server uses a modular architecture with three main components:

1. **WebSocketServer**: Main server class that manages connections and routes messages
2. **ClientManager**: Handles client registration, storage, and querying
3. **Handlers**: Event-specific processors that handle different message types

### Client Types

The server supports multiple client types for different use cases:

- `BROWSER_EXTENSION`: Browser extensions and web clients
- `RASPBERRY_PI`: IoT devices and single-board computers
- `HARDWARE`: Custom hardware devices
- `CLI`: Command-line applications
- `UNKNOWN`: Unspecified or custom client types

## API Reference

### WebSocketServer

#### Constructor

```typescript
new WebSocketServer(
    httpServer: HttpServer,
    config?: Partial<IWebSocketServerConfig>,
    logger?: ILogger
)
```

**Parameters:**
- `httpServer`: HTTP server instance to attach WebSocket server to
- `config`: Optional server configuration
- `logger`: Optional logger implementation

#### Configuration Options

```typescript
interface IWebSocketServerConfig {
    path?: string;                    // WebSocket path, default: '/'
    maxConnections?: number;          // Max concurrent connections, default: unlimited
    pingInterval?: number;            // Ping interval in ms, default: 30000
    clientTimeout?: number;           // Client timeout in ms, default: 60000
    messageFormat?: MessageFormat;    // Message format, default: 'envelope'
    cors?: {
        origin: string | string[];    // CORS origins
        credentials?: boolean;         // Allow credentials
    };
    clientManager?: IClientManagerConfig;  // Client manager settings
}
```

#### Core Methods

##### Handler Management

```typescript
// Register an event handler
registerHandler(handler: IEventHandler): void

// Get a registered handler
getHandler(eventName: string): IEventHandler | undefined
```

##### Client Queries

```typescript
// Get client by ID
getClient(clientId: string): IClientConnection | undefined

// Get all active clients
getAllClients(): IClientConnection[]

// Get clients by type
getClientsByType(clientType: ClientType): IClientConnection[]

// Get clients by capability
getClientsByCapability(capability: string): IClientConnection[]
```

##### Broadcasting

```typescript
// Broadcast to all clients of a specific type
broadcastToClientType(clientType: ClientType, event: string, data: unknown): void

// Broadcast to all clients with a specific capability
broadcastToCapability(capability: string, event: string, data: unknown): void
```

##### Statistics

```typescript
// Get connection statistics
getConnectionStats(): {
    total: number;
    byType: Record<ClientType, number>;
    authenticated: number;
}
```

##### Lifecycle

```typescript
// Gracefully shutdown the server
shutdown(): Promise<void>
```

### BaseHandler

Base class for creating event handlers:

```typescript
class MyHandler extends BaseHandler<MyDataType> {
    readonly eventName = 'my_event';

    async handle(socket: ISocketWrapper, data: MyDataType, context: IHandlerContext): Promise<void> {
        // Handle the event
        // Access client info via context.client
        // Send responses via socket.emit()
    }
}
```

### ClientManager

Manages client connections and provides querying capabilities:

```typescript
// Register a new client
registerClient(
    socket: ISocketWrapper,
    clientType: ClientType,
    capabilities: string[],
    userAgent?: string,
    metadata?: Record<string, any>,
    user?: IUserInfo
): IClientConnection

// Remove a client
removeClient(clientId: string): void

// Update client metadata
updateClientMetadata(clientId: string, metadata: Record<string, any>): void
```

## Message Formats

The server supports two message formats:

### Envelope Format (Recommended)
```json
{
    "id": "msg_1234567890_abc123",
    "type": "chat_message",
    "timestamp": 1640995200000,
    "payload": {
        "message": "Hello world",
        "sessionId": "session_123"
    }
}
```

### Legacy Format (Backward Compatible)
```json
{
    "type": "chat_message",
    "message": "Hello world",
    "sessionId": "session_123"
}
```

## Authentication

The server includes built-in authentication support:

```typescript
interface IUserInfo {
    userId?: string;
    sessionToken?: string;
    isAuthenticated: boolean;
    permissions: string[];
}
```

Clients can be registered with authentication information:

```typescript
wss.clientManager.registerClient(socket, ClientType.BROWSER_EXTENSION,
    ['chat', 'file_upload'],
    'Chrome/91.0',
    { version: '1.0.0' },
    {
        userId: 'user123',
        sessionToken: 'token456',
        isAuthenticated: true,
        permissions: ['read', 'write']
    }
);
```

## Rate Limiting

Built-in rate limiting to prevent abuse:

```typescript
import { SimpleRateLimiter } from '@jarvis/ws-server';

const limiter = new SimpleRateLimiter({
    windowMs: 60000,  // 1 minute
    maxRequests: 100  // 100 requests per minute
});

if (!limiter.checkLimit(clientId)) {
    socket.emit('error', { message: 'Rate limit exceeded' });
    return;
}
```

## Logging

The server uses an injectable logger interface:

```typescript
interface ILogger {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}

// Example with Winston
import winston from 'winston';

const logger: ILogger = {
    info: (msg, meta) => winston.info(msg, meta),
    warn: (msg, meta) => winston.warn(msg, meta),
    error: (msg, meta) => winston.error(msg, meta),
    debug: (msg, meta) => winston.debug(msg, meta)
};

const wss = new WebSocketServer(httpServer, config, logger);
```

## Examples

### Browser Extension Handler

```typescript
class BrowserExtensionHandler extends BaseHandler {
    readonly eventName = 'tool_execution_request';

    async handle(socket, data, context) {
        // Handle tool execution requests from browser extensions
        const { toolName, parameters } = data;

        try {
            const result = await executeTool(toolName, parameters);
            socket.emit('tool_execution_response', {
                requestId: data.requestId,
                success: true,
                result
            });
        } catch (error) {
            socket.emit('tool_execution_response', {
                requestId: data.requestId,
                success: false,
                error: error.message
            });
        }
    }
}
```

### IoT Device Registration

```typescript
// Handle Raspberry Pi registration
class DeviceRegistrationHandler extends BaseHandler {
    readonly eventName = 'device_registration';

    async handle(socket, data, context) {
        const deviceInfo = {
            deviceId: data.deviceId,
            capabilities: ['sensor_reading', 'gpio_control'],
            metadata: {
                model: data.model,
                firmware: data.firmware
            }
        };

        wss.clientManager.registerClient(
            socket,
            ClientType.RASPBERRY_PI,
            deviceInfo.capabilities,
            data.userAgent,
            deviceInfo.metadata
        );

        socket.emit('registration_confirmed', {
            clientId: socket.id,
            capabilities: deviceInfo.capabilities
        });
    }
}
```

### Connection Monitoring

```typescript
// Log connection statistics every minute
setInterval(() => {
    const stats = wss.getConnectionStats();
    console.log('Connection stats:', stats);

    // Alert if too many unauthenticated connections
    if (stats.authenticated < stats.total * 0.8) {
        console.warn('High number of unauthenticated connections');
    }
}, 60000);
```

## Testing

```bash
npm test
npm run test:coverage
```

The package includes comprehensive test coverage:
- **158 total tests** covering all major functionality
- Unit tests for individual components
- Integration tests for end-to-end scenarios
- Mock implementations for external dependencies

## Advanced Usage

### Custom Handler with Dependency Injection

```typescript
class DatabaseHandler extends BaseHandler {
    constructor(clientManager: ClientManager, private db: Database) {
        super(clientManager);
    }

    readonly eventName = 'database_query';

    async handle(socket, data, context) {
        try {
            const result = await this.db.query(data.query);
            socket.emit('query_result', { result });
        } catch (error) {
            this.emitError(socket, 'Database query failed', error.message);
        }
    }
}
```

### Middleware Pattern

```typescript
class AuthMiddleware {
    async authenticate(socket: ISocketWrapper, data: any): Promise<boolean> {
        // Custom authentication logic
        return true; // or false
    }
}

class AuthenticatedHandler extends BaseHandler {
    constructor(clientManager: ClientManager, private auth: AuthMiddleware) {
        super(clientManager);
    }

    async handle(socket, data, context) {
        if (!(await this.auth.authenticate(socket, data))) {
            this.emitError(socket, 'Authentication failed');
            return;
        }

        // Handle authenticated request
    }
}
```

## Error Handling

The server includes comprehensive error handling:

- **Validation**: Input validation for all client data
- **Sanitization**: Metadata sanitization to prevent injection attacks
- **Timeouts**: Automatic cleanup of stale connections
- **Graceful Shutdown**: Proper cleanup on server shutdown
- **Error Propagation**: Detailed error reporting to clients

## Performance Considerations

- **Connection Limits**: Configurable maximum concurrent connections
- **Ping/Pong**: Regular health checks to detect dead connections
- **Memory Management**: Automatic cleanup of disconnected clients
- **Rate Limiting**: Built-in protection against abuse
- **Efficient Broadcasting**: Optimized message delivery to multiple clients

## License

ISC