import { DynamicTool } from '@langchain/core/tools';

/**
 * Tool for getting the current date and time.
 * Useful when the LLM needs to know what time it is.
 */
export const DateTimeTool = new DynamicTool({
    name: 'get_current_datetime',
    description: 'Get the current date and time in a human-readable format. Use this when you need to know what day it is, what time it is, or answer questions about the current date/time.',
    func: async () => {
        const now = new Date();

        return now.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    }
});
