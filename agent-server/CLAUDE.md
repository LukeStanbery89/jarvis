# Agent Server Project

## Overview
Express.js server for agentic browser extension that provides AI-powered page summarization, real-time chat with conversation management, and WebSocket-based bidirectional communication with persistent sessions.

## Architecture
- **Express Server**: REST API with CORS enabled for cross-origin requests
- **WebSocket Server**: Socket.io for real-time bidirectional communication with browser extensions
- **LangGraph Integration**: Simplified agent architecture using LangGraph reactive agents
- **Multi-Client Sessions**: Isolated conversation histories per client using thread-based memory
- **Client Management**: Multi-client connection handling with capability-based routing
- **Dependency Injection**: TSyringe container for streamlined service management

## Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **WebSockets**: Socket.io
- **AI**: LangGraph with OpenAI GPT models
- **Search**: Tavily API for real-time web search
- **Memory**: LangGraph MemorySaver with thread-based isolation
- **Dependency Injection**: TSyringe with simplified service architecture
- **Logging**: Winston with two-tier structured logging
- **Build**: TypeScript compiler (tsc)
- **Testing**: Jest

## Development Commands
```bash
# Development (with auto-reload)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Environment Setup
Required environment variables:
- `OPENAI_API_KEY`: OpenAI API key for AI interactions
- `SERPER_API_KEY`: Serper API key for web search functionality

Optional environment variables:
- `OPENAI_MODEL`: OpenAI model to use (defaults to 'gpt-4.1-mini')
- `PORT`: Server port (defaults to 3000)
- `VERBOSE_LOGGING`: Enable detailed logging (true/false, defaults to false)
- `LOG_LEVEL`: Winston log level (error/warn/info/debug, defaults to info)
- `LOG_TO_FILE`: Enable file logging (true/false, defaults to false)

## Project Structure
```
src/
├── index.ts                    # Express server setup and dependency injection
├── container.ts                # TSyringe DI container configuration
├── controllers/                # REST API controllers
│   ├── HealthController.ts     # Health check endpoint
│   └── SummarizeController.ts  # Content summarization API (standalone OpenAI)
├── services/                   # Business logic services
│   └── ChatService.ts          # LangGraph agent with web search and memory
├── utils/                      # Utility functions
│   └── logger.ts               # Winston two-tier logging utility
├── websocket/                  # WebSocket infrastructure
│   ├── index.ts               # WebSocket server setup
│   ├── types.ts               # WebSocket type definitions
│   ├── ClientManager.ts       # Client connection management
│   ├── handlers/              # Message handlers
│   │   ├── BaseHandler.ts     # Base handler with logging
│   │   ├── ChatHandler.ts     # Simplified chat processing via ChatService
│   │   ├── ToolHandler.ts     # Tool request/response handling
│   │   └── RegistrationHandler.ts # Client registration
│   ├── services/              # WebSocket services
│   │   └── AuthenticationService.ts # Client authentication
│   └── utils/helpers.ts       # Utility functions
└── routes/index.ts            # Route configuration
```

## Key Features

### REST API
- `GET /health`: Health check endpoint
- `POST /api/summarize`: Content summarization with OpenAI

### WebSocket Communication
- **Client Registration**: Multi-client type support with capability detection
- **Chat Messages**: Bidirectional messaging with persistent session management
- **Conversation Management**: Intelligent conversation summarization and context trimming
- **Tool Orchestration**: Request/response pattern for browser extension tools
- **Status Updates**: Real-time status updates during processing
- **Session Persistence**: Automatic cleanup and memory management

### Client Types Supported
- Browser extensions with capabilities like:
  - Page content extraction
  - DOM manipulation
  - Browser API access
  - Tab management
  - Storage access

## Security & Authentication
- **CORS**: Enabled for cross-origin requests
- **WebSocket Security**: CORS configuration for multiple client origins
- **Client Authentication**: Service-based authentication framework (expandable)
- **Session Security**: Isolated conversation contexts per session
- **Future**: User authentication and authorization system planned

## Server Capabilities
- **Agent-Powered Chat**: LangGraph reactive agents with web search capabilities
- **Real-time Web Search**: Current information access via Tavily API
- **Tool Selection**: Agents automatically decide when to search
- **Conversation Memory**: LangGraph MemorySaver with thread-based isolation per client
- **Multi-client Support**: Concurrent client connections with capability routing
- **Session Management**: Persistent conversation contexts across reconnections
- **Memory Management**: Thread-based memory isolation prevents cross-client data leakage
- **Structured Logging**: Two-tier Winston logging with verbose debugging mode

## Logging System

### Two-Tier Winston Logging
The server uses Winston with a two-tier logging approach:

**MINIMAL MODE** (default):
- Service initialization and shutdown
- User actions (chat messages, web searches)
- Errors and warnings
- Key business events with essential metadata

**VERBOSE MODE** (`VERBOSE_LOGGING=true`):
- All minimal mode logs
- Detailed execution flow and internal state
- LangGraph agent and tool execution steps
- Performance metrics and timing
- Debug information for troubleshooting

### Usage Examples
```typescript
import { logger } from '../utils/logger';

// Minimal logging (always shown)
logger.info('User message received', { sessionId, messageLength: 50 });
logger.error('Search API failed', { error: error.message, sessionId });

// Verbose logging (only when VERBOSE_LOGGING=true)
logger.debug('Tool execution started', { toolName: 'web_search', query });
logger.verbose('Agent state change', { agentType: 'OpenAI', step: 'parsing' });
```

### Configuration
- `VERBOSE_LOGGING=true` - Enable detailed debugging logs
- `LOG_LEVEL=debug` - Set Winston log level
- `LOG_TO_FILE=true` - Enable file logging (optional)

## Architecture Details

### Chat Service
The `ChatService` is the core component that handles all AI interactions:
- **LangGraph Agent**: Uses `createReactAgent` with OpenAI models and Tavily search tools
- **Memory Isolation**: Each client gets isolated conversation history via `thread_id: clientId`
- **Tool Integration**: Automatic web search when agents determine current information is needed
- **Error Handling**: Graceful failure handling with informative error messages

### WebSocket Architecture
- **Handler-Based Routing**: Event-driven message processing through dedicated handlers
- **Client Management**: Connection tracking with capability-based client identification
- **Authentication**: Extensible authentication service for future user management
- **Real-Time Communication**: Bidirectional messaging between server and browser extensions

### Dependency Injection
TSyringe container manages service lifecycles:
- `ChatService`: Singleton for AI interactions
- `ClientManager`: Connection management
- `AuthenticationService`: Client authentication and permissions

## Code Conventions
- 4-space indentation
- TypeScript with strict mode enabled
- ES2020 target with modern JavaScript features
- Error handling with try-catch blocks
- Winston structured logging with two-tier approach (minimal/verbose)
- Use 127.0.0.1 instead of localhost
- All interface names prefixed with capital I
- Dependency injection for service management with TSyringe
- LangGraph agents for AI-powered functionality

## Multi-Client Session Management

### Thread-Based Isolation
Each browser extension client maintains an independent conversation history:
- **Client Identification**: Uses `context.clientId` as unique identifier
- **Thread Mapping**: LangGraph `thread_id: clientId` ensures memory isolation
- **Session Persistence**: Conversations persist across WebSocket reconnections
- **Memory Safety**: No cross-contamination between different clients

### Use Cases
- Multiple browser tabs with the extension installed
- Different browser extension instances across user sessions
- Concurrent users with separate conversation contexts
- Development and testing with isolated chat histories