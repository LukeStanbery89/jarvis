# Agentic Browser Extension

## Overview
AI-powered browser extension providing real-time chat interface and page content summarization. Features persistent session management, markdown-rendered responses, and WebSocket-based communication with an agent server.

## Architecture
- **Browser Extension**: Chrome extension with tabbed popup UI and content scripts
- **WebSocket Client**: Real-time communication with persistent session management
- **Content Extraction**: Intelligent page content parsing and selection detection
- **Session Management**: Persistent conversation contexts across popup sessions
- **Markdown Rendering**: Rich text formatting for AI responses
- **Persistent State**: Local storage for session, chat history, and summary persistence

## Tech Stack
- **Runtime**: Browser extension environment with TypeScript
- **Build System**: Vite with custom static file copying
- **Testing**: Vitest with jsdom for DOM testing (45 tests, 100% pass rate)
- **Styling**: Tailwind CSS with PostCSS
- **WebSocket**: Socket.io client for real-time communication
- **Markdown**: Marked.js for rich text rendering
- **Code Quality**: ESLint + Prettier

## Development Commands
```bash
# Build for development (with watch mode)
npm run dev

# Build for production
npm run build:prod

# Type checking
npm run type-check

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Testing
npm run test        # Watch mode
npm run test:run    # Single run
npm run test:ui     # UI mode
npm run test:coverage
```

## Project Structure
```
src/
├── content.ts        # Content script for page content extraction
├── popup.ts          # Popup UI logic with summarization
├── popup.html        # Extension popup interface
├── styles.css        # Tailwind CSS styles
├── websocket.ts      # WebSocket manager for server communication
├── manifest.json     # Extension manifest
└── test/             # Test files with Vitest setup
```

## Key Features

### Content Extraction
- **Semantic Parsing**: Extracts headers, paragraphs, lists, and blockquotes
- **Ad Filtering**: Removes advertisement and promotional content
- **Visibility Detection**: Filters hidden and invisible elements
- **Selection Support**: Prioritizes selected text over full page content
- **Content Limiting**: 8000 character limit for API efficiency

### WebSocket Communication
- **Client Registration**: Registers as browser extension with capabilities
- **Session Management**: Persistent session IDs stored in chrome.storage.local
- **Chat Messages**: Real-time bidirectional chat with session continuity
- **Tool Requests**: Handles server requests for page manipulation
- **Real-time Status**: Receives agent processing status updates
- **Reconnection**: Automatic reconnection with session persistence

### Browser Extension Tools
Available capabilities:
- `page_content_extraction`: Extract full page content
- `extract_page_content`: Server-triggered content extraction
- `get_selected_text`: Extract user-selected text
- `scroll_to_element`: Scroll to specified DOM elements
- `dom_manipulation`: Modify page elements
- `browser_api_access`: Chrome APIs access
- `tab_management`: Tab operations
- `storage_access`: Local storage operations

### Popup Interface
- **Tabbed Interface**: Chat (default) and Summarize tabs
- **Chat Interface**: Primary interaction mode with markdown-rendered AI responses
- **Real-time Chat**: Persistent conversations with session management
- **Clear Conversation**: Trash icon button to reset chat history
- **Summarization**: Secondary feature for page content summarization
- **Status Updates**: Real-time processing feedback
- **Error Handling**: User-friendly error messages
- **State Persistence**: Chat history and session persistence across popup sessions
- **Responsive Design**: Taller chat window (36rem) for better conversation viewing

## Configuration

### Manifest Permissions
- `activeTab`: Access current tab content
- `scripting`: Execute content scripts
- `storage`: Local data persistence

### Build Configuration
- **Vite**: ES module bundling with custom static file plugin
- **TypeScript**: Strict mode with Chrome types
- **Path Aliases**: `@/` for src, `@shared/` for shared types

### Server Connection
Default WebSocket server: `ws://127.0.0.1:3000`

## Recent Updates
- **UI Redesign**: Chat tab now primary interface (first and default)
- **Increased Height**: Chat window expanded to 36rem (576px) for better conversation viewing
- **Markdown Support**: Rich text rendering for AI responses with comprehensive styling
- **Session Persistence**: Chat sessions persist across browser restarts and popup sessions
- **Clear Conversation**: Trash icon button for easy conversation reset
- **Improved Storage**: Original markdown content preservation for proper re-rendering
- **Enhanced Testing**: 45 comprehensive tests covering session management and UI interactions

## Code Conventions
- 4-space indentation
- TypeScript with strict type checking
- ES2020 modules
- Comprehensive error handling with user feedback
- Console logging for debugging
- Event-driven architecture for WebSocket communication
- Use 127.0.0.1 instead of localhost
- Secure markdown parsing with XSS protection

## Testing Strategy
- **Unit Tests**: Individual component testing (13 WebSocket tests)
- **Integration Tests**: End-to-end session management flows (13 tests)
- **UI Tests**: Popup functionality and markdown rendering (16 tests)
- **Content Tests**: Page extraction and DOM manipulation (3 tests)
- **Mock Infrastructure**: Comprehensive mocking prevents real API calls
- **Session Testing**: Complete coverage of session persistence and cleanup
- **Safety Checks**: No LLM credits consumed during testing
- **jsdom Environment**: Browser API simulation with Chrome extension mocks