import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";

const WikipediaSearch = new WikipediaQueryRun({
    topKResults: 3,
    maxDocContentLength: 4000,
});

WikipediaSearch.description = "Look up encyclopedic, factual, or complete information such as biographies and structured data about a specific topic. Use this instead of web search when you need completeness, and when there is not a more specialized tool available. For music-specific queries (albums, songs, discographies), use MusicBrainz instead which has more detailed music metadata.";

export default WikipediaSearch;