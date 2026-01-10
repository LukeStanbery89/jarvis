import dotenv from "dotenv";
import { Serper } from "@langchain/community/tools/serper";

dotenv.config();

const SerperWebSearch = new Serper(process.env.SERPER_API_KEY);
SerperWebSearch.description = "Web search using Serper API. First 2,500 queries are free. Subsequent queries require credits. Prefer a free web search tool over this one, if possible.";

export default SerperWebSearch;