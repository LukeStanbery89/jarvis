import dotenv from "dotenv";
import { TavilySearch } from '@langchain/tavily';

dotenv.config();

export default new TavilySearch({
    description: `Use only: 

- For very recent news, such as the name of an upcoming album.
- When Wikipedia is insufficient
- When a more specialized tool is not available. 

Notes:
- Results may be incomplete. 
- Input should be a search query. 
- Free to use, but limited to 1000 queries per month.`,
    maxResults: 3,
});