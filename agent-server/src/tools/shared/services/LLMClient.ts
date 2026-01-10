import { ChatOpenAI } from '@langchain/openai';
import { IChatLLM } from '../types';

/**
 * LLM client implementation using OpenAI ChatGPT
 * This provides a mockable interface for LLM interactions
 */
export class OpenAIChatClient implements IChatLLM {
    private llm: ChatOpenAI;

    constructor(options?: {
        modelName?: string;
        temperature?: number;
    }) {
        this.llm = new ChatOpenAI({
            modelName: options?.modelName || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            temperature: options?.temperature ?? 0
        });
    }

    async invoke(prompt: string): Promise<{ content: string; }> {
        const result = await this.llm.invoke(prompt);
        return {
            content: result.content.toString()
        };
    }
}