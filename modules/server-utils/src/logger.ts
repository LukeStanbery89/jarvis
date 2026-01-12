import winston from 'winston';

/**
 * Simple Winston Logger Utility
 * 
 * === TWO-TIER LOGGING ===
 * 
 * **MINIMAL MODE** (default):
 * - info(), warn(), error() - always logged
 * 
 * **VERBOSE MODE** (VERBOSE_LOGGING=true):
 * - debug(), verbose() - only logged when verbose enabled
 * - More detailed metadata
 * 
 * === USAGE ===
 * 
 * ```typescript
 * import { logger } from '../utils/logger';
 * 
 * // Minimal logging (always shown)
 * logger.info('User message received', { sessionId, messageLength: 50 });
 * logger.error('Search API failed', { error: error.message, sessionId });
 * 
 * // Verbose logging (only when VERBOSE_LOGGING=true)
 * logger.debug('Tool execution started', { toolName: 'web_search', query });
 * logger.verbose('LangChain chain event', { event: 'start', chainType: 'Agent' });
 * ```
 */

class Logger {
    private winston: winston.Logger;
    private isVerbose: boolean;
    private MAX_VALUE_LENGTH: number = 200;

    constructor() {
        this.isVerbose = process.env.VERBOSE_LOGGING === 'true';

        const customFormat = winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
            winston.format.colorize({ all: true }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let logLine = `${timestamp} [${level}] ${message}`;

                // Add metadata if present
                const metaKeys = Object.keys(meta);
                if (metaKeys.length > 0) {
                    // Clean up metadata
                    const cleanMeta = { ...meta };
                    delete cleanMeta.timestamp;
                    delete cleanMeta.level;

                    if (Object.keys(cleanMeta).length > 0) {
                        logLine += ` ${JSON.stringify(cleanMeta)}`;
                    }
                }

                return logLine;
            })
        );

        this.winston = winston.createLogger({
            level: this.isVerbose ? 'debug' : 'info',
            format: customFormat,
            transports: [
                new winston.transports.Console()
            ]
        });

        this.info('Logger initialized', {
            verboseMode: this.isVerbose,
            logLevel: this.winston.level
        });
    }

    /**
     * MINIMAL LOGGING - Always logged
     */
    info(message: string, metadata: object = {}): void {
        this.winston.info(message, this.formatMetadata(metadata));
    }

    warn(message: string, metadata: object = {}): void {
        this.winston.warn(message, this.formatMetadata(metadata));
    }

    error(message: string, metadata: object = {}): void {
        this.winston.error(message, this.formatMetadata(metadata));
    }

    /**
     * VERBOSE LOGGING - Only logged when VERBOSE_LOGGING=true
     */
    debug(message: string, metadata: object = {}): void {
        if (this.isVerbose) {
            this.winston.debug(message, this.formatMetadata(metadata));
        }
    }

    verbose(message: string, metadata: object = {}): void {
        if (this.isVerbose) {
            this.winston.debug(`[VERBOSE] ${message}`, this.formatMetadata(metadata));
        }
    }

    /**
     * Format metadata for consistent output
     */
    private formatMetadata(metadata: object): object {
        const formatted: any = {};

        for (const [key, value] of Object.entries(metadata)) {
            // Truncate long strings in minimal mode
            if (typeof value === 'string' && value.length > this.MAX_VALUE_LENGTH && !this.isVerbose) {
                formatted[key] = value.substring(0, this.MAX_VALUE_LENGTH) + '...';
            } else {
                formatted[key] = value;
            }
        }

        return formatted;
    }
}

// Export singleton instance
export const logger = new Logger();