import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatService, CHAT_SERVICE_TOKEN } from './services/ChatService';
import { AuthenticationService } from './services/AuthenticationService';
import { ToolExecutionManager, ToolSecurityValidator } from '@jarvis/rag-tools-server';
import { BrowserToolService } from './services/BrowserToolService';

export function setupContainer(): void {
    // Register simplified services
    container.registerSingleton<ChatService>(CHAT_SERVICE_TOKEN, ChatService);

    container.register<AuthenticationService>(AuthenticationService, {
        useClass: AuthenticationService
    });

    // Register tool execution services
    container.registerSingleton<ToolExecutionManager>(ToolExecutionManager);
    container.registerSingleton<ToolSecurityValidator>(ToolSecurityValidator);
    container.registerSingleton<BrowserToolService>(BrowserToolService);
}

export { container };