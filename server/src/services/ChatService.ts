import { inject, injectable } from 'tsyringe';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { AgentResponse, ChatMessage } from '@jarvis/protocol';
import { IHandlerContext } from '../websocket/types';
import { logger } from '../utils/logger';
import { LangGraphCallback } from '../utils/LangGraphCallback';
import { BrowserToolService } from './BrowserToolService';
import tools from "../tools";

/**
 * Enhanced Chat Service using LangGraph with Comprehensive Logging
 * 
 * Consolidates chat functionality into a single service that:
 * - Uses LangGraph for agent creation and memory management
 * - Maintains separate chat histories per client using thread_id
 * - Provides web search capabilities via Tavily
 * - Handles message generation with proper client isolation
 * - Comprehensive logging of tool usage, LLM calls, and agent reasoning
 * - Real-time monitoring of agent execution steps
 */
@injectable()
export class ChatService {
    private agent: any;
    private checkpointer: MemorySaver = new MemorySaver();

    constructor(
        @inject(BrowserToolService) private browserToolService?: BrowserToolService
    ) {
        this.initializeAgent();
        const browserToolsCount = this.browserToolService ? this.browserToolService.getTools().length : 0;
        logger.info('ChatService initialized with LangGraph agent', {
            service: 'ChatService',
            hasWebSearch: true,
            memoryEnabled: true,
            verboseLogging: process.env.VERBOSE_LOGGING === 'true',
            standardTools: tools.length,
            browserTools: browserToolsCount,
            toolsAvailable: tools.map(tool => tool.name || 'unnamed_tool')
        });
    }

    /**
     * Initialize the LangGraph agent with tools and memory
     */
    private initializeAgent(): void {
        // Create OpenAI model
        const llm = new ChatOpenAI({
            temperature: 0.7,
            modelName: process.env.OPENAI_MODEL || ""
        });

        // Initialize memory for multi-client support
        this.checkpointer = new MemorySaver();

        // Combine standard tools with browser tools
        const allTools: any[] = [...tools];
        
        // Add browser tools if service is available
        if (this.browserToolService) {
            const browserTools = this.browserToolService.getTools();
            allTools.push(...browserTools);
        }

        // Create the reactive agent
        this.agent = createReactAgent({
            llm,
            tools: allTools,
            checkpointSaver: this.checkpointer
        });

        logger.info('LangGraph agent created successfully', {
            service: 'ChatService',
            toolCount: allTools.length,
            standardTools: tools.length,
            browserTools: this.browserToolService ? this.browserToolService.getTools().length : 0,
            toolNames: allTools.map(tool => tool.name || 'unnamed_tool'),
            model: process.env.OPENAI_MODEL || "",
            temperature: 0.7,
            memoryType: 'MemorySaver'
        });
    }

    /**
     * Process chat message and generate response
     * 
     * @param data - Chat message data
     * @param context - Handler context with client information
     * @returns Promise<AgentResponse> - Generated response
     */
    async processMessage(data: ChatMessage, context: IHandlerContext): Promise<AgentResponse> {
        const startTime = Date.now();
        const clientId = context.clientId;

        logger.info('Processing chat message with LangGraph', {
            service: 'ChatService',
            clientId,
            sessionId: data.sessionId,
            messageLength: data.content.length,
            messagePreview: data.content.substring(0, 100) + (data.content.length > 100 ? '...' : '')
        });

        // Create callback handler for this session
        const callbackHandler = new LangGraphCallback(data.sessionId, clientId);

        try {
            // Execute agent with session-specific thread ID for memory isolation and logging callbacks
            // Use sessionId instead of clientId to enable proper conversation clearing
            const threadId = data.sessionId || clientId; // Fallback to clientId if no sessionId
            const agentFinalState = await this.agent.invoke(
                { messages: [new HumanMessage(data.content)] },
                { 
                    configurable: { thread_id: threadId },
                    callbacks: [callbackHandler]
                }
            );

            const responseContent = agentFinalState.messages[agentFinalState.messages.length - 1];
            const executionTime = Date.now() - startTime;
            const messageCount = agentFinalState.messages.length;

            logger.info('LangGraph agent execution completed', {
                service: 'ChatService',
                clientId,
                sessionId: data.sessionId,
                executionTime,
                responseLength: responseContent.content.length,
                totalMessages: messageCount,
                responsePreview: responseContent.content.toString().substring(0, 150) + 
                    (responseContent.content.toString().length > 150 ? '...' : '')
            });

            // Create response object
            const response: AgentResponse = {
                id: this.generateMessageId(),
                type: 'agent_response',
                timestamp: Date.now(),
                content: responseContent.content.toString(),
                sessionId: data.sessionId,
                reasoning: `Generated using LangGraph agent with web search capabilities (${executionTime}ms)`,
            };

            return response;

        } catch (error) {
            const executionTime = Date.now() - startTime;

            logger.error('LangGraph agent execution failed', {
                service: 'ChatService',
                clientId,
                sessionId: data.sessionId,
                executionTime,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });

            // Log additional error context
            logger.error('Additional error context', {
                service: 'ChatService',
                clientId,
                sessionId: data.sessionId,
                originalMessage: data.content.substring(0, 100),
                threadId: clientId
            });

            throw new Error(`Chat processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clear conversation history for a specific client
     * 
     * @param clientId - Client ID to clear history for
     */
    async clearHistory(clientId: string): Promise<void> {
        try {
            // Note: With session-based threading, conversation clearing works automatically
            // When client creates a new session ID, it gets a fresh thread in LangGraph
            // The old thread remains in memory but is no longer accessible
            logger.info('Conversation clear requested - client will use new session thread', {
                service: 'ChatService',
                clientId,
                note: 'Using session-based threading for automatic conversation isolation'
            });

        } catch (error) {
            logger.error('Failed to process conversation clear request', {
                service: 'ChatService',
                clientId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get conversation statistics
     */
    getStats(): {
        agentInitialized: boolean;
        memoryEnabled: boolean;
        toolsAvailable: number;
    } {
        return {
            agentInitialized: !!this.agent,
            memoryEnabled: !!this.checkpointer,
            toolsAvailable: 1 // Web search tool
        };
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const CHAT_SERVICE_TOKEN = 'ChatService';