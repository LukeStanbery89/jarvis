/**
 * Server tools - now using @jarvis/rag-tools-server module
 *
 * This file re-exports all RAG tools from the shared module
 */

// Import all tools from the module
import serverTools, {
    DateTimeTool,
    WeatherTool,
    MusicBrainzSearch,
    TavilyWebSearch,
    WikipediaSearch,
    SerperWebSearch,
    HomeAssistantTools,
    BrowserExtensionTool,
    ToolExecutionManager,
    ToolSecurityValidator
} from '@jarvis/rag-tools-server';

// Re-export the default tool array
export default serverTools;

// Re-export individual tools
export {
    DateTimeTool,
    WeatherTool,
    MusicBrainzSearch,
    TavilyWebSearch,
    WikipediaSearch,
    SerperWebSearch,
    HomeAssistantTools,
    BrowserExtensionTool,
    ToolExecutionManager,
    ToolSecurityValidator
};

// Re-export any types that might be needed
export * from '@jarvis/rag-tools-server';