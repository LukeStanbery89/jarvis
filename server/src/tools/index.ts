import TavilyWebSearch from './tavily';
import WikipediaSearch from './wikipedia';
import MusicBrainzSearch from './musicbrainz';
import HomeAssistantTools from './home_assistant';
import WeatherTool from './weather';
// import SerperWebSearch from './serper';

export default [
    // SerperWebSearch, // FIXME: Figure out how to make the LLM prefer Tavily (free) over Serper (paid)
    WeatherTool,  // Weather information using Open-Meteo API
    ...HomeAssistantTools,  // Home Assistant tools for smart home control
    MusicBrainzSearch,  // Put MusicBrainz first for music query priority
    WikipediaSearch,
    TavilyWebSearch,
];

// Individual exports for direct access
export { default as WeatherTool } from './weather';
export { default as MusicBrainzSearch } from './musicbrainz';
export { default as TavilyWebSearch } from './tavily';
export { default as WikipediaSearch } from './wikipedia';
export { default as SerperWebSearch } from './serper';
export { default as HomeAssistantTools } from './home_assistant';