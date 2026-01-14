/**
 * Simple logging utility for browser extension tools
 *
 * Provides structured logging with service identification
 * and different log levels for development and debugging.
 */

export interface LogContext {
    service?: string;
    [key: string]: any;
}

class BrowserLogger {
    private isDevelopment = process.env.NODE_ENV === 'development';

    /**
     * Log info message
     */
    info(message: string, context?: LogContext): void {
        this.log('INFO', message, context);
    }

    /**
     * Log debug message (only in development)
     */
    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            this.log('DEBUG', message, context);
        }
    }

    /**
     * Log verbose message (only in development)
     */
    verbose(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            this.log('VERBOSE', message, context);
        }
    }

    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext): void {
        this.log('WARN', message, context);
    }

    /**
     * Log error message
     */
    error(message: string, context?: LogContext): void {
        this.log('ERROR', message, context);
    }

    /**
     * Internal log method
     */
    private log(level: string, message: string, context?: LogContext): void {
        const timestamp = new Date().toISOString();
        const service = context?.service || 'BrowserTools';

        const logMessage = `[${timestamp}] [${level}] [${service}] ${message}`;

        if (context && Object.keys(context).length > 1) {
            // Remove service from context to avoid duplication
            const { service: _, ...restContext } = context;
            console.log(logMessage, restContext);
        } else {
            console.log(logMessage);
        }
    }
}

export const logger = new BrowserLogger();
