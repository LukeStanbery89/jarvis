# AI Chat Agent API Contract

## Overview
This document provides a comprehensive API contract for the AI-powered chat application, designed to guide the development of a C client. The system uses both REST API and WebSocket communication protocols for different functionalities.

## Base Configuration
- **Server Address**: `127.0.0.1:3000`
- **REST Base URL**: `http://127.0.0.1:3000`
- **WebSocket URL**: `ws://127.0.0.1:3000`
- **Transport**: Raw WebSocket protocol

## REST API Endpoints

### Health Check
```
GET /health
Response: 200 OK
{
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Content Summarization
```
POST /api/summarize
Content-Type: application/json

Request Body:
{
    "content": "string (required)",
    "title": "string (optional)"
}

Response: 200 OK
{
    "summary": "string",
    "title": "string",
    "timestamp": "2024-01-01T00:00:00.000Z"
}

Error Response: 400/500
{
    "error": "string",
    "details": "string (optional)"
}
```

## WebSocket Communication

### Connection Setup
1. Connect to WebSocket endpoint: `ws://127.0.0.1:3000`
2. Use native WebSocket API or compatible library
3. All messages are JSON-encoded strings

### Client Registration
**Required** - Must be sent immediately after connection:

```json
{
    "id": "msg_1234567890_abcdef123",
    "type": "client_registration",
    "timestamp": 1234567890000,
    "clientType": "browser_extension",
    "capabilities": ["array_of_string_capabilities"],
    "userAgent": "string (optional)",
    "metadata": {
        "extensionVersion": "string (optional)",
        "browserName": "string (optional)"
    }
}
```

Send as JSON string over WebSocket connection

**Server Response**:
```json
{
    "id": "string",
    "type": "registration_confirmed",
    "timestamp": 1234567890000,
    "clientId": "socket_id",
    "capabilities": ["server_capabilities"]
}
```

Received as JSON message with `type: "registration_confirmed"`

### Chat Communication

#### Send Chat Message
```json
{
    "id": "msg_1234567890_abcdef123",
    "type": "chat_message",
    "timestamp": 1234567890000,
    "content": "User message content",
    "sessionId": "session_1234567890_abcdef123"
}
```

Send as JSON string over WebSocket connection

#### Receive Agent Response
```json
{
    "id": "string",
    "type": "agent_response",
    "timestamp": 1234567890000,
    "content": "AI agent response content",
    "reasoning": "string (optional)",
    "sessionId": "session_1234567890_abcdef123",
    "toolsUsed": [
        {
            "tool": "web_search",
            "input": "search query",
            "output": "search results",
            "executionTime": 1500
        }
    ]
}
```

Received as JSON message with `type: "agent_response"`

#### Agent Status Updates
```json
{
    "id": "string",
    "type": "agent_status",
    "timestamp": 1234567890000,
    "status": "thinking|searching|analyzing|using_tool|complete|error",
    "currentTool": "string (optional)",
    "message": "string (optional)"
}
```

Received as JSON message with `type: "agent_status"`

### Session Management

#### Clear Conversation
```json
{
    "id": "msg_1234567890_abcdef123",
    "type": "clear_conversation",
    "timestamp": 1234567890000,
    "clientId": "socket_id",
    "sessionId": "session_1234567890_abcdef123"
}
```

Send as JSON string over WebSocket connection

**Server Response**:
```json
{
    "id": "string",
    "type": "conversation_cleared",
    "timestamp": 1234567890000,
    "sessionId": "string"
}
```

Received as JSON message with `type: "conversation_cleared"`

### Tool Execution System

#### Tool Execution Request (Server → Client)
```json
{
    "id": "string",
    "type": "tool_execution_request",
    "timestamp": 1234567890000,
    "executionId": "exec_1234567890_abcdef123",
    "toolName": "extract_page_content",
    "parameters": {
        "url": "string (optional)",
        "selector": "string (optional)"
    },
    "timeout": 30000,
    "securityContext": {
        "allowedOrigins": ["https://example.com"],
        "permissions": ["page_access"],
        "parameterValidation": {}
    }
}
```

Received as JSON message with `type: "tool_execution_request"`

#### Tool Execution Response (Client → Server)
```json
{
    "id": "msg_1234567890_abcdef123",
    "type": "tool_execution_response",
    "timestamp": 1234567890000,
    "executionId": "exec_1234567890_abcdef123",
    "success": true,
    "result": {
        "title": "Page Title",
        "content": "Page content...",
        "url": "https://example.com",
        "isSelection": false
    },
    "error": {
        "type": "validation|permission|timeout|browser_api|network|unknown",
        "message": "Error description",
        "recoverable": true,
        "retryAfter": 5000
    },
    "executionTime": 1500
}
```

Send as JSON string over WebSocket connection

#### Tool Execution Status Updates
```json
{
    "id": "string",
    "type": "tool_execution_status",
    "timestamp": 1234567890000,
    "executionId": "exec_1234567890_abcdef123",
    "status": "queued|executing|completed|failed|timeout",
    "progress": 50,
    "statusMessage": "Processing request..."
}
```

Received as JSON message with `type: "tool_execution_status"`

### Connection Monitoring

#### Ping/Pong
```json
{
    "id": "msg_1234567890_abcdef123",
    "type": "ping",
    "timestamp": 1234567890000
}
```

Send as JSON string over WebSocket connection

### Error Handling
```json
{
    "id": "string",
    "type": "error",
    "timestamp": 1234567890000,
    "message": "Error description",
    "code": "error_code (optional)"
}
```

Received as JSON message with `type: "error"`

## Data Types and Structures

### Base Message Interface
All messages inherit from:
```c
typedef struct {
    char id[64];           // Format: "msg_timestamp_randomstring"
    char type[32];         // Message type identifier
    long timestamp;        // Unix timestamp in milliseconds
} base_message_t;
```

### Client Capabilities
Standard capabilities for browser extension clients:
- `"page_content_extraction"`
- `"extract_page_content"`
- `"get_selected_text"`
- `"scroll_to_element"`
- `"dom_manipulation"`
- `"browser_api_access"`
- `"tab_management"`
- `"storage_access"`

### Session ID Format
- Format: `"session_timestamp_randomstring"`
- Example: `"session_1234567890_abcdef123"`
- Should persist across reconnections
- Used for conversation continuity

### Message ID Format
- Format: `"msg_timestamp_randomstring"`
- Example: `"msg_1234567890_abcdef123"`
- Must be unique per message
- Used for request/response correlation

## Implementation Guidelines for C Client

### WebSocket Library Recommendations
For C implementations, consider these WebSocket libraries:
- **libwebsockets**: Full-featured, widely used
- **wslay**: Simple, minimal WebSocket library
- **nopoll**: Easy-to-use WebSocket library
- **Simple implementation**: Use raw sockets with WebSocket handshake

### Connection Flow
1. Establish WebSocket connection to `ws://127.0.0.1:3000`
2. Send `client_registration` message immediately as JSON string
3. Wait for `registration_confirmed` message
4. Handle all incoming messages by parsing JSON and checking `type` field
5. Begin normal chat communication

### Session Management
1. Generate session ID on first message
2. Persist session ID locally (file/memory)
3. Reuse session ID for conversation continuity
4. Clear session ID when conversation is cleared

### Message Handling
1. All messages must include `id`, `type`, and `timestamp`
2. Send messages using `websocket.send(JSON.stringify(message))`
3. Receive messages via `websocket.onmessage` and parse with `JSON.parse(event.data)`
4. Route incoming messages based on `type` field
5. Implement proper error handling for malformed JSON

### Reconnection Strategy
1. Detect connection loss via `websocket.onclose` event
2. Attempt reconnection with exponential backoff
3. Re-register client after reconnection
4. Resume with existing session ID

### Tool Execution (Optional)
For advanced clients that want to support tool execution:
1. Parse incoming messages and check for `type: "tool_execution_request"`
2. Validate security context and permissions
3. Execute requested tool with parameters
4. Send `tool_execution_response` message as JSON string
5. Handle timeouts and error conditions

### Error Handling
1. Parse error messages from server
2. Implement retry logic for transient errors
3. Handle authentication/permission errors gracefully
4. Log errors appropriately for debugging

## Security Considerations
1. **Input Validation**: Validate all incoming JSON messages
2. **Permission Checking**: Respect security contexts in tool requests
3. **Origin Validation**: Verify allowed origins for tool execution
4. **Timeout Handling**: Implement proper timeouts for all operations
5. **Error Sanitization**: Don't expose sensitive information in error messages

## Environment Variables
For local development:
```bash
OPENAI_API_KEY="your_openai_key"
SERPER_API_KEY="your_serper_key"
OPENAI_MODEL="gpt-4o-mini"  # optional
PORT=3000                    # optional
```

## Protocol Changes from Socket.io

**Key Differences:**
1. **No Socket.io protocol overhead** - Direct JSON messages
2. **No event namespacing** - Use `type` field for message routing
3. **No automatic reconnection** - Must implement manually
4. **No rooms/broadcasting** - Point-to-point communication only
5. **Simpler error handling** - Standard WebSocket error events

**Migration Benefits:**
- Simpler protocol implementation
- Better suited for C clients
- No external library dependencies
- Easier debugging and monitoring
- Direct compatibility with WebSocket tools