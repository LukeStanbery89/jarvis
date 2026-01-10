import { ILangGraphConfig, ILangGraphServiceConfig, ILangGraphCallbackOrchestrator } from '../interfaces/ILangGraphServices';
import { DataSanitizerService } from '../services/DataSanitizerService';
import { NameExtractorService } from '../services/NameExtractorService';
import { ToolLoggerService } from '../services/ToolLoggerService';
import { LLMLoggerService } from '../services/LLMLoggerService';
import { ChainLoggerService } from '../services/ChainLoggerService';
import { AgentLoggerService } from '../services/AgentLoggerService';
import { RetrieverLoggerService } from '../services/RetrieverLoggerService';
import { LangGraphCallbackOrchestrator } from '../services/LangGraphCallbackOrchestrator';

/**
 * Factory for creating LangGraph callback services
 * Provides production and testing configurations
 */
export class LangGraphCallbackFactory {
    /**
     * Create production instance with default services
     */
    static create(sessionId: string, clientId: string): ILangGraphCallbackOrchestrator {
        const config: ILangGraphConfig = {
            sessionId,
            clientId,
            verbose: process.env.VERBOSE_LOGGING === 'true'
        };

        return this.createOrchestrator(config);
    }

    /**
     * Create test instance with configurable verbose mode
     */
    static createForTesting(
        sessionId: string,
        clientId: string,
        verbose: boolean = false
    ): ILangGraphCallbackOrchestrator {
        const config: ILangGraphConfig = {
            sessionId,
            clientId,
            verbose
        };

        return this.createOrchestrator(config);
    }

    /**
     * Create orchestrator with custom service configuration
     */
    static createWithConfig(serviceConfig: ILangGraphServiceConfig): ILangGraphCallbackOrchestrator {
        const config = serviceConfig.config;
        
        const dataSanitizer = serviceConfig.dataSanitizer || new DataSanitizerService();
        const nameExtractor = serviceConfig.nameExtractor || new NameExtractorService();
        const toolLogger = serviceConfig.toolLogger || new ToolLoggerService(config, dataSanitizer);
        const llmLogger = serviceConfig.llmLogger || new LLMLoggerService(config, dataSanitizer);
        const chainLogger = serviceConfig.chainLogger || new ChainLoggerService(config);
        const agentLogger = serviceConfig.agentLogger || new AgentLoggerService(config, dataSanitizer);
        const retrieverLogger = serviceConfig.retrieverLogger || new RetrieverLoggerService(config, dataSanitizer);

        return new LangGraphCallbackOrchestrator(
            config,
            nameExtractor,
            toolLogger,
            llmLogger,
            chainLogger,
            agentLogger,
            retrieverLogger
        );
    }

    /**
     * Create orchestrator with default services
     */
    private static createOrchestrator(config: ILangGraphConfig): ILangGraphCallbackOrchestrator {
        const dataSanitizer = new DataSanitizerService();
        const nameExtractor = new NameExtractorService();
        const toolLogger = new ToolLoggerService(config, dataSanitizer);
        const llmLogger = new LLMLoggerService(config, dataSanitizer);
        const chainLogger = new ChainLoggerService(config);
        const agentLogger = new AgentLoggerService(config, dataSanitizer);
        const retrieverLogger = new RetrieverLoggerService(config, dataSanitizer);

        return new LangGraphCallbackOrchestrator(
            config,
            nameExtractor,
            toolLogger,
            llmLogger,
            chainLogger,
            agentLogger,
            retrieverLogger
        );
    }
}