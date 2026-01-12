import TavilyWebSearch from './tavily';
import WikipediaSearch from './wikipedia';
import MusicBrainzSearch from './musicbrainz';
import HomeAssistantTools from './home_assistant';
import WeatherTool from './weather';
import { DateTimeTool } from './datetime';
// import SerperWebSearch from './serper';

/**
 * Default export: Array of all server-side tools for LangChain agents
 *
 * Tools are ordered by priority/specificity:
 * 1. DateTimeTool - Current date and time
 * 2. WeatherTool - Weather information using Open-Meteo API
 * 3. HomeAssistantTools - Home Assistant tools for smart home control
 * 4. MusicBrainzSearch - Music metadata (prioritized for music queries)
 * 5. WikipediaSearch - Encyclopedic information
 * 6. TavilyWebSearch - Web search (free tier, limited to 1000 queries/month)
 */
export default [
    // SerperWebSearch, // FIXME: Figure out how to make the LLM prefer Tavily (free) over Serper (paid)
    DateTimeTool,  // Current date and time
    WeatherTool,  // Weather information using Open-Meteo API
    ...HomeAssistantTools,  // Home Assistant tools for smart home control
    MusicBrainzSearch,  // Put MusicBrainz first for music query priority
    WikipediaSearch,
    TavilyWebSearch,
];

/**
 * Individual tool exports for direct access
 */
export { DateTimeTool } from './datetime';
export { default as WeatherTool } from './weather';
export { default as MusicBrainzSearch } from './musicbrainz';
export { default as TavilyWebSearch } from './tavily';
export { default as WikipediaSearch } from './wikipedia';
export { default as SerperWebSearch } from './serper';
export { default as HomeAssistantTools } from './home_assistant';

/**
 * Re-export shared types and utilities
 */
export * from './shared/types';

/**
 * Browser integration tools (LangChain tool wrappers for browser extension)
 */
export { BrowserExtensionTool } from './browser/BrowserExtensionTool';
export { ToolExecutionManager } from './browser/ToolExecutionManager';
export { ToolSecurityValidator } from './browser/ToolSecurityValidator';
