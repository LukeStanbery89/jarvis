export interface IChatLLM {
    invoke(prompt: string): Promise<{ content: string; }>;
}
