# J.A.R.V.I.S. Browser Extension

An AI-powered browser extension providing real-time chat interface, intelligent page content extraction, and tool execution capabilities. Features persistent session management, markdown-rendered responses, and WebSocket-based communication with an agent server.

## Features

### Real-time Chat
- **Persistent Conversations**: Session-based chat that survives browser restarts
- **Markdown Rendering**: Rich text formatting for AI responses
- **Real-time Communication**: WebSocket-based bidirectional messaging
- **Session Management**: Automatic session creation and persistence

### Content Intelligence
- **Smart Extraction**: Extracts main content while filtering ads and navigation
- **Selection Detection**: Prioritizes user-selected text over full page content
- **Semantic Preservation**: Maintains HTML structure (headings, paragraphs, lists)
- **Content Limiting**: Optimized 8000-character limit for efficient processing

### Tool Execution
- **Page Content Extraction**: Server-triggered content gathering
- **URL Navigation**: Programmatic tab and window management
- **DOM Manipulation**: Element interaction and modification
- **Browser API Access**: Comprehensive Chrome extension APIs
- **Storage Operations**: Local data persistence and retrieval

### User Experience
- **Tabbed Interface**: Dedicated Chat and Summarize tabs
- **Responsive Design**: Optimized for various screen sizes
- **Status Updates**: Real-time processing feedback
- **Error Handling**: User-friendly error messages and recovery
- **Settings Management**: Configurable server connections

## Setup Instructions

### Prerequisites
- Node.js and npm installed
- A running J.A.R.V.I.S. agent server (WebSocket server on port 3000)
- Chrome browser for extension installation

### Installation
1. Clone the repository and navigate to the browser extension directory:
   ```bash
   cd browser_extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Install in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `browser_extension/dist` directory

### Configuration
- **Server URL**: Configure the WebSocket server URL in extension settings
- **Default Server**: `ws://127.0.0.1:3000` (must start with `ws://` or `wss://`)

## Usage

### Chat Interface
1. Click the extension icon in Chrome toolbar
2. Select the "Chat" tab (default)
3. Type your message and press Enter
4. View AI responses with markdown formatting
5. Conversations persist across browser sessions

### Page Summarization
1. Navigate to any web page
2. Click the extension icon
3. Select the "Summarize" tab
4. Click "Summarize This" button
5. Wait for AI-generated summary

### Content Selection
- Select text on any page before opening the extension
- The extension will prioritize selected content over full page extraction

## Development

### Available Scripts
```bash
# Development build with watch mode
npm run dev

# Production build
npm run build:prod

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test          # Watch mode
npm run test:run      # Single run
npm run test:ui       # UI mode
npm run test:coverage # With coverage
```

### Architecture
- **Background Script**: Persistent WebSocket connection management
- **Content Script**: Page content extraction and DOM manipulation
- **Popup Interface**: User interaction and real-time chat
- **Tool System**: Extensible server-requested operations
- **Settings Page**: Configuration and server management

### Browser Permissions
- `activeTab`: Access current tab content
- `scripting`: Execute content scripts
- `storage`: Local data persistence
- `tabs`: Tab management operations

## Testing

The extension includes comprehensive test coverage:
- **45 total tests** with 100% pass rate
- Unit tests for individual components
- Integration tests for session management
- UI tests for popup functionality
- Content extraction and DOM manipulation tests

Run tests with:
```bash
npm run test:coverage
```

## Dependencies

### Core Dependencies
- `@jarvis/ws-client`: WebSocket client with reconnection and session management
- `@jarvis/device-identity`: Device identification and storage adapters
- `@jarvis/protocol`: Communication protocol definitions
- `marked`: Markdown rendering library

### Development Dependencies
- TypeScript, Vite, Vitest for build and testing
- Tailwind CSS for styling
- ESLint and Prettier for code quality

## Contributing

1. Follow TypeScript strict mode and existing code conventions
2. Add tests for new functionality
3. Update documentation for API changes
4. Use 4-space indentation and proper error handling

## License

ISC