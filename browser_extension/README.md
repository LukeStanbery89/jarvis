# J.A.R.V.I.S. The AI-powered Browser Extension

A Chrome extension that uses a local LLM (via Ollama) to summarize web pages.

## Setup Instructions

### Prerequisites
- [Ollama](https://ollama.ai/) installed and running locally
- A compatible LLM model (e.g., `llama3.2`) pulled in Ollama
- Node.js and npm installed

### Server Setup
1. Navigate to the `agent-server` directory
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure if needed
4. Start the server: `npm run dev`

### Extension Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `agent-browser-extension` directory
4. The extension should now appear in your Chrome toolbar

### Usage
1. Navigate to any web page
2. Click the extension icon in the toolbar
3. Click "Summarize This"
4. Wait for the AI-generated summary to appear

## Features
- Extracts main content from web pages while filtering out ads and navigation
- Preserves semantic HTML structure (headings, paragraphs, lists) for better context
- Local AI processing via Ollama for privacy
- Clean, responsive popup interface
- Error handling and loading states

## Configuration
The server can be configured via environment variables:
- `PORT`: Server port (default: 3000)
- `OLLAMA_HOST`: Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model to use (default: llama3.2)