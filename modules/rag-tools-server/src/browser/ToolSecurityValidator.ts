import { injectable } from 'tsyringe';
import { ToolExecutionRequest, ToolSecurityContext, ToolDefinition } from '@jarvis/protocol';
import { IClientConnection } from '@jarvis/ws-server';
import { logger } from '@jarvis/server-utils';

/**
 * Security validation for browser extension tool execution
 * 
 * Handles:
 * - Parameter validation against tool schemas
 * - Origin verification 
 * - Permission checking
 * - Client capability validation
 * - Security context enforcement
 */

export interface SecurityValidationError {
    type: 'validation' | 'permission' | 'origin' | 'capability';
    message: string;
    details?: any;
}

@injectable()
export class ToolSecurityValidator {
    private allowedOrigins: string[];

    constructor() {
        // Load allowed origins from environment
        this.allowedOrigins = process.env.ALLOWED_TOOL_ORIGINS?.split(',') || ['localhost', '127.0.0.1'];
        
        logger.info('ToolSecurityValidator initialized', {
            service: 'ToolSecurityValidator',
            allowedOrigins: this.allowedOrigins
        });
    }

    /**
     * Validate tool execution request
     */
    async validateToolRequest(
        request: ToolExecutionRequest,
        client: IClientConnection,
        toolDefinition: ToolDefinition
    ): Promise<void> {
        // 1. Validate client capabilities
        await this.validateClientCapabilities(request, client);
        
        // 2. Validate security context
        await this.validateSecurityContext(request.securityContext);
        
        // 3. Validate tool parameters
        await this.validateToolParameters(request.parameters, toolDefinition);
        
        // 4. Check permissions
        await this.validatePermissions(request, client);

        logger.verbose('Tool security validation passed', {
            service: 'ToolSecurityValidator',
            executionId: request.executionId,
            toolName: request.toolName,
            clientId: client.id
        });
    }

    /**
     * Validate client has required capabilities for the tool
     */
    private async validateClientCapabilities(
        request: ToolExecutionRequest,
        client: IClientConnection
    ): Promise<void> {
        // Check if client has the specific tool capability
        const hasToolCapability = client.capabilities.includes(request.toolName);
        const hasGeneralBrowserCapability = client.capabilities.includes('browser_api_access');
        
        if (!hasToolCapability && !hasGeneralBrowserCapability) {
            throw this.createSecurityError(
                'capability',
                `Client does not have capability for tool: ${request.toolName}`,
                { 
                    clientCapabilities: client.capabilities,
                    requiredCapability: request.toolName
                }
            );
        }
    }

    /**
     * Validate security context
     */
    private async validateSecurityContext(securityContext: ToolSecurityContext): Promise<void> {
        // Validate origins
        if (securityContext.allowedOrigins) {
            const hasValidOrigin = securityContext.allowedOrigins.some(origin => 
                this.allowedOrigins.includes(origin)
            );
            
            if (!hasValidOrigin) {
                throw this.createSecurityError(
                    'origin',
                    'Request origin not in allowed origins list',
                    { 
                        requestOrigins: securityContext.allowedOrigins,
                        allowedOrigins: this.allowedOrigins
                    }
                );
            }
        }

        // Validate permissions format
        if (securityContext.permissions && !Array.isArray(securityContext.permissions)) {
            throw this.createSecurityError(
                'validation',
                'Security context permissions must be an array',
                { permissions: securityContext.permissions }
            );
        }
    }

    /**
     * Validate tool parameters against schema
     */
    private async validateToolParameters(
        parameters: Record<string, unknown>,
        toolDefinition: ToolDefinition
    ): Promise<void> {
        const schema = toolDefinition.parameters;
        
        if (!schema || !schema.properties) {
            logger.verbose('No parameter schema defined for tool', {
                service: 'ToolSecurityValidator',
                toolName: toolDefinition.name
            });
            return;
        }

        // Check required parameters
        if (schema.required) {
            for (const requiredParam of schema.required) {
                if (!(requiredParam in parameters)) {
                    throw this.createSecurityError(
                        'validation',
                        `Missing required parameter: ${requiredParam}`,
                        { 
                            requiredParameters: schema.required,
                            providedParameters: Object.keys(parameters)
                        }
                    );
                }
            }
        }

        // Validate parameter types and constraints
        for (const [paramName, paramValue] of Object.entries(parameters)) {
            const paramSchema = schema.properties[paramName];
            
            if (paramSchema) {
                await this.validateParameterValue(paramName, paramValue, paramSchema);
            }
        }
    }

    /**
     * Validate individual parameter value
     */
    private async validateParameterValue(
        paramName: string,
        value: unknown,
        schema: any
    ): Promise<void> {
        // Basic type validation
        if (schema.type) {
            const actualType = typeof value;
            const expectedType = schema.type;
            
            if (actualType !== expectedType) {
                throw this.createSecurityError(
                    'validation',
                    `Parameter '${paramName}' has invalid type. Expected ${expectedType}, got ${actualType}`,
                    { parameter: paramName, expectedType, actualType, value }
                );
            }
        }

        // String-specific validations
        if (schema.type === 'string' && typeof value === 'string') {
            // URL validation for URL parameters
            if (paramName.toLowerCase().includes('url') || schema.format === 'uri') {
                await this.validateUrlParameter(paramName, value);
            }
            
            // Length validation
            if (schema.maxLength && value.length > schema.maxLength) {
                throw this.createSecurityError(
                    'validation',
                    `Parameter '${paramName}' exceeds maximum length of ${schema.maxLength}`,
                    { parameter: paramName, maxLength: schema.maxLength, actualLength: value.length }
                );
            }

            // Pattern validation
            if (schema.pattern) {
                const regex = new RegExp(schema.pattern);
                if (!regex.test(value)) {
                    throw this.createSecurityError(
                        'validation',
                        `Parameter '${paramName}' does not match required pattern`,
                        { parameter: paramName, pattern: schema.pattern, value }
                    );
                }
            }
        }
    }

    /**
     * Validate URL parameters for security
     */
    private async validateUrlParameter(paramName: string, url: string): Promise<void> {
        try {
            const urlObj = new URL(url);
            
            // Block dangerous protocols
            const dangerousProtocols = ['javascript:', 'data:', 'file:', 'ftp:'];
            if (dangerousProtocols.some(protocol => urlObj.protocol === protocol)) {
                throw this.createSecurityError(
                    'validation',
                    `URL parameter '${paramName}' uses forbidden protocol: ${urlObj.protocol}`,
                    { parameter: paramName, protocol: urlObj.protocol, url }
                );
            }
            
            // Block localhost/private IPs in production
            if (process.env.NODE_ENV === 'production') {
                const hostname = urlObj.hostname.toLowerCase();
                const privateHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
                const isPrivateIP = privateHosts.includes(hostname) || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.') ||
                    hostname.startsWith('172.');
                    
                if (isPrivateIP) {
                    throw this.createSecurityError(
                        'validation',
                        `URL parameter '${paramName}' targets private/local address`,
                        { parameter: paramName, hostname, url }
                    );
                }
            }
            
        } catch (error) {
            if (error instanceof Error && error.name === 'SecurityValidationError') {
                throw error;
            }
            
            throw this.createSecurityError(
                'validation',
                `Invalid URL format for parameter '${paramName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
                { parameter: paramName, url }
            );
        }
    }

    /**
     * Validate user permissions for tool execution
     */
    private async validatePermissions(
        request: ToolExecutionRequest,
        client: IClientConnection
    ): Promise<void> {
        // For now, use basic permission checking
        // This can be extended with role-based access control later
        
        const userPermissions = client.user.permissions || [];
        const requiredPermissions = request.securityContext.permissions || [];
        
        for (const requiredPermission of requiredPermissions) {
            if (!userPermissions.includes(requiredPermission) && !userPermissions.includes('admin')) {
                throw this.createSecurityError(
                    'permission',
                    `User lacks required permission: ${requiredPermission}`,
                    { 
                        userPermissions,
                        requiredPermissions,
                        userId: client.user.userId
                    }
                );
            }
        }
    }

    /**
     * Create formatted security error
     */
    private createSecurityError(
        type: SecurityValidationError['type'],
        message: string,
        details?: any
    ): Error {
        const error = new Error(message) as Error & { securityError: SecurityValidationError };
        error.name = 'SecurityValidationError';
        error.securityError = { type, message, details };
        
        logger.warn('Security validation failed', {
            service: 'ToolSecurityValidator',
            errorType: type,
            errorMessage: message,
            details
        });
        
        return error;
    }

    /**
     * Check if error is a security validation error
     */
    static isSecurityError(error: any): error is Error & { securityError: SecurityValidationError } {
        return error && error.name === 'SecurityValidationError' && error.securityError;
    }
}