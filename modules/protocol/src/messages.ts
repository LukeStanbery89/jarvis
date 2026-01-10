/**
 * Core message types for WebSocket communication between clients and server.
 * These types define the protocol contract shared across all components.
 */

/**
 * Base interface for all WebSocket messages.
 * All messages must include id, type, and timestamp for tracking and routing.
 */
export interface BaseMessage {
    id: string;
    type: string;
    timestamp: number;
}

/**
 * Client → Server: User chat message
 */
export interface ChatMessage extends BaseMessage {
    type: 'chat_message';
    content: string;
    sessionId: string;
}

/**
 * Server → Client: AI agent response
 */
export interface AgentResponse extends BaseMessage {
    type: 'agent_response';
    content: string;
    reasoning?: string;
    sessionId: string;
    toolsUsed?: Array<{
        tool: string;
        input: string;
        output: string;
        executionTime?: number;
    }>;
}

/**
 * Server → Client: Agent processing status update
 */
export interface AgentStatus extends BaseMessage {
    type: 'agent_status';
    status: 'thinking' | 'searching' | 'analyzing' | 'using_tool' | 'complete' | 'error';
    currentTool?: string;
    message?: string;
}

/**
 * Tool definition structure
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}

/**
 * Security context for tool execution
 */
export interface ToolSecurityContext {
    allowedOrigins: string[];
    permissions: string[];
    parameterValidation: Record<string, any>;
}

/**
 * Server → Client: Request to execute a tool
 */
export interface ToolExecutionRequest extends BaseMessage {
    type: 'tool_execution_request';
    executionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    timeout?: number;
    securityContext: ToolSecurityContext;
}

/**
 * Client → Server: Tool execution result
 */
export interface ToolExecutionResponse extends BaseMessage {
    type: 'tool_execution_response';
    executionId: string;
    success: boolean;
    result?: any;
    error?: {
        type: 'validation' | 'permission' | 'timeout' | 'browser_api' | 'network' | 'unknown';
        message: string;
        recoverable: boolean;
        retryAfter?: number;
    };
    executionTime: number;
}

/**
 * Bidirectional: Tool execution status update
 */
export interface ToolExecutionStatus extends BaseMessage {
    type: 'tool_execution_status';
    executionId: string;
    status: 'queued' | 'executing' | 'completed' | 'failed' | 'timeout';
    progress?: number;
    statusMessage?: string;
}

/**
 * Client → Server: Client registration message
 */
export interface ClientRegistration extends BaseMessage {
    type: 'client_registration';
    clientType: string;
    capabilities: string[];
    userAgent?: string;
    metadata?: Record<string, any>;
}

/**
 * Tool-specific result types
 */
export interface PageContent {
    title: string;
    content: string;
    url: string;
    isSelection: boolean;
}

export interface SearchResult {
    title: string;
    snippet: string;
    url: string;
}

export interface NavigationResult {
    success: boolean;
    url: string;
    error?: string;
}

/**
 * Legacy types (maintained for backward compatibility)
 */
export interface ToolResponse extends BaseMessage {
    type: 'tool_response';
    toolName: string;
    result: any;
    error?: string;
    requestId: string;
}

export interface ToolRequest extends BaseMessage {
    type: 'tool_request';
    toolName: string;
    parameters: Record<string, any>;
    requestId: string;
}

export interface ExtensionReady extends BaseMessage {
    type: 'extension_ready';
    extensionId: string;
    url: string;
}

/**
 * Agent conversation types
 */
export interface ToolCall {
    toolName: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
}
