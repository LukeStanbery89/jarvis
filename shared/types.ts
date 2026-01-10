// Shared types for WebSocket communication between extension and server

export interface BaseMessage {
    id: string;
    type: string;
    timestamp: number;
}

// Extension → Server Messages
export interface ChatMessage extends BaseMessage {
    type: 'chat_message';
    content: string;
    sessionId: string;
}

// Legacy tool response (keeping for backward compatibility)
export interface ToolResponse extends BaseMessage {
    type: 'tool_response';
    toolName: string;
    result: any;
    error?: string;
    requestId: string;
}

// Enhanced tool execution types
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}

export interface ToolSecurityContext {
    allowedOrigins: string[];
    permissions: string[];
    parameterValidation: Record<string, any>;
}

export interface ToolExecutionRequest extends BaseMessage {
    type: 'tool_execution_request';
    executionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    timeout?: number;
    securityContext: ToolSecurityContext;
}

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

export interface ToolExecutionStatus extends BaseMessage {
    type: 'tool_execution_status';
    executionId: string;
    status: 'queued' | 'executing' | 'completed' | 'failed' | 'timeout';
    progress?: number;
    statusMessage?: string;
}

export interface ExtensionReady extends BaseMessage {
    type: 'extension_ready';
    extensionId: string;
    url: string;
}

// Server → Extension Messages
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

export interface ToolRequest extends BaseMessage {
    type: 'tool_request';
    toolName: string;
    parameters: Record<string, any>;
    requestId: string;
}

export interface AgentStatus extends BaseMessage {
    type: 'agent_status';
    status: 'thinking' | 'searching' | 'analyzing' | 'using_tool' | 'complete' | 'error';
    currentTool?: string;
    message?: string;
}

// Tool-specific types
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

// Agent conversation types
export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
}

export interface ToolCall {
    toolName: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
}

// Storage types
export interface StoredConversation {
    sessionId: string;
    url: string;
    messages: ConversationMessage[];
    lastUpdated: number;
}

export interface StoredPageContext {
    url: string;
    summary: string;
    timestamp: number;
    title: string;
}