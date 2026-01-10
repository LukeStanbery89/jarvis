import { injectable } from 'tsyringe';
import { ToolExecutionRequest, ToolExecutionResponse } from '@jarvis/protocol';
import { IClientConnection } from '../../websocket/types';
import { logger } from '../../utils/logger';

/**
 * Manages tool execution on browser extension clients
 * 
 * Handles:
 * - Asynchronous tool execution with Promise-based responses
 * - Timeout management and cleanup
 * - Client disconnection scenarios
 * - Execution state tracking
 * - Error handling and recovery
 */

interface PendingExecution {
    resolve: (result: string) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
    client: IClientConnection;
    request: ToolExecutionRequest;
}

@injectable()
export class ToolExecutionManager {
    private pendingExecutions = new Map<string, PendingExecution>();
    private executionStats = {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        timeoutExecutions: 0
    };

    /**
     * Execute a tool on a specific browser client
     */
    async executeToolOnClient(
        client: IClientConnection,
        request: ToolExecutionRequest
    ): Promise<string> {
        logger.info('Starting tool execution', {
            service: 'ToolExecutionManager',
            executionId: request.executionId,
            toolName: request.toolName,
            clientId: client.id,
            timeout: request.timeout
        });

        this.executionStats.totalExecutions++;

        return new Promise((resolve, reject) => {
            const timeoutMs = request.timeout || 30000; // 30 second default
            
            const timeout = setTimeout(() => {
                this.handleExecutionTimeout(request.executionId);
            }, timeoutMs);

            // Store pending execution with all necessary context
            this.pendingExecutions.set(request.executionId, {
                resolve,
                reject,
                timeout,
                startTime: Date.now(),
                client,
                request
            });

            try {
                // Send request to client
                client.socket.emit('tool_execution_request', request);
                
                logger.verbose('Tool execution request sent to client', {
                    service: 'ToolExecutionManager',
                    executionId: request.executionId,
                    clientId: client.id
                });
            } catch (error) {
                // Clean up and reject immediately if sending fails
                this.cleanupExecution(request.executionId);
                this.executionStats.failedExecutions++;
                reject(new Error(`Failed to send tool request: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });
    }

    /**
     * Handle tool execution response from client
     */
    handleToolResponse(response: ToolExecutionResponse): void {
        const pending = this.pendingExecutions.get(response.executionId);
        if (!pending) {
            logger.warn('Received response for unknown execution', {
                service: 'ToolExecutionManager',
                executionId: response.executionId,
                toolName: 'unknown'
            });
            return;
        }

        const executionTime = Date.now() - pending.startTime;

        logger.info('Tool execution completed', {
            service: 'ToolExecutionManager',
            executionId: response.executionId,
            success: response.success,
            executionTime: executionTime,
            clientReportedTime: response.executionTime
        });

        // Clean up timeout and remove from pending
        this.cleanupExecution(response.executionId);

        if (response.success) {
            this.executionStats.completedExecutions++;
            // Format result for LangChain
            const resultString = this.formatToolResult(response.result);
            pending.resolve(resultString);
        } else {
            this.executionStats.failedExecutions++;
            const error = response.error || { type: 'unknown', message: 'Tool execution failed', recoverable: false };
            pending.reject(new Error(`Tool execution failed [${error.type}]: ${error.message}`));
        }
    }

    /**
     * Handle tool execution timeout
     */
    private handleExecutionTimeout(executionId: string): void {
        const pending = this.pendingExecutions.get(executionId);
        if (!pending) return;

        logger.warn('Tool execution timeout', {
            service: 'ToolExecutionManager',
            executionId,
            toolName: pending.request.toolName,
            timeout: pending.request.timeout,
            clientId: pending.client.id
        });

        this.executionStats.timeoutExecutions++;
        this.cleanupExecution(executionId);
        pending.reject(new Error(`Tool execution timeout: ${pending.request.toolName}`));
    }

    /**
     * Handle client disconnection - fail all pending executions for that client
     */
    handleClientDisconnection(clientId: string): void {
        const failedExecutions: string[] = [];

        for (const [executionId, pending] of this.pendingExecutions.entries()) {
            if (pending.client.id === clientId) {
                failedExecutions.push(executionId);
                this.cleanupExecution(executionId);
                pending.reject(new Error(`Client disconnected during tool execution: ${pending.request.toolName}`));
            }
        }

        if (failedExecutions.length > 0) {
            logger.warn('Failed pending tool executions due to client disconnection', {
                service: 'ToolExecutionManager',
                clientId,
                failedExecutions: failedExecutions.length,
                executionIds: failedExecutions
            });
            
            this.executionStats.failedExecutions += failedExecutions.length;
        }
    }

    /**
     * Clean up execution tracking
     */
    private cleanupExecution(executionId: string): void {
        const pending = this.pendingExecutions.get(executionId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingExecutions.delete(executionId);
        }
    }

    /**
     * Format tool result for LangChain consumption
     */
    private formatToolResult(result: any): string {
        if (typeof result === 'string') {
            return result;
        }
        
        if (typeof result === 'object' && result !== null) {
            // Handle common result patterns
            if (result.success && result.message) {
                return result.message;
            }
            
            if (result.content) {
                return result.content;
            }
            
            if (result.url) {
                return `Successfully processed URL: ${result.url}`;
            }
            
            // Fallback to JSON representation
            try {
                return JSON.stringify(result, null, 2);
            } catch {
                return String(result);
            }
        }
        
        return String(result);
    }

    /**
     * Get execution statistics
     */
    getStats() {
        return {
            ...this.executionStats,
            pendingExecutions: this.pendingExecutions.size
        };
    }

    /**
     * Get pending executions for a specific client
     */
    getPendingExecutionsForClient(clientId: string): number {
        let count = 0;
        for (const pending of this.pendingExecutions.values()) {
            if (pending.client.id === clientId) {
                count++;
            }
        }
        return count;
    }

    /**
     * Generate unique execution ID
     */
    generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}