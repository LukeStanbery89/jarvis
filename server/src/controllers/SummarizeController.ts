import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../utils/logger';

@injectable()
export class SummarizeController {
    private chatModel: ChatOpenAI;

    constructor() {
        this.chatModel = new ChatOpenAI({
            modelName: process.env.OPENAI_MODEL || "",
            temperature: 0.3
        });
    }

    async summarize(req: Request, res: Response): Promise<void> {
        try {
            const { content, title } = req.body;

            if (!content) {
                res.status(400).json({ error: 'Content is required' });
                return;
            }

            // Generate summary using OpenAI directly
            const summaryPrompt = `Please provide a concise summary of the following content${title ? ` titled "${title}"` : ''}:

${content}

Provide a summary that captures the key points in 2-3 sentences:`;

            const response = await this.chatModel.invoke([
                { role: 'user', content: summaryPrompt }
            ]);
            const summary = response.content as string;

            res.json({
                summary,
                title: title || 'Untitled',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error generating summary', {
                service: 'SummarizeController',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Failed to generate summary',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}