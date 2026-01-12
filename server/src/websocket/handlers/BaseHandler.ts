import { inject } from 'tsyringe';
import { BaseHandler as WsBaseHandler, ClientManager } from '@jarvis/ws-server';
import { logger } from '@jarvis/server-utils';

/**
 * Server-specific BaseHandler that extends ws-server BaseHandler
 *
 * Adds application-specific customizations:
 * - TSyringe dependency injection for ClientManager
 * - Winston logger integration from @jarvis/server-utils
 * - Verbose logging for detailed diagnostics
 */
export abstract class BaseHandler<TData = unknown> extends WsBaseHandler<TData> {
    /**
     * Constructor with TSyringe dependency injection
     * Automatically injects ClientManager and passes Winston logger to base
     */
    constructor(
        @inject(ClientManager) clientManager: ClientManager
    ) {
        super(clientManager, logger);
    }

    /**
     * Override logActivity to use Winston's verbose level for detailed logging
     * This provides better control over log verbosity in production
     */
    protected logActivity(action: string, details?: any): void {
        if (details) {
            logger.verbose(action, { service: this.eventName, ...details });
        } else {
            logger.info(action, { service: this.eventName });
        }
    }
}