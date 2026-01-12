import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initWebSocketServer } from './websocket';
import { setupContainer, container } from './container';
import { initRoutes } from './routes';
import { ChatService, CHAT_SERVICE_TOKEN } from './services/ChatService';
import { logger } from '@jarvis/server-utils';

// Import WebSocket services for singleton registration
import { AuthenticationService } from './services/AuthenticationService';

dotenv.config();

// Setup dependency injection container
setupContainer();

container.registerSingleton(AuthenticationService);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = createServer(app);

// Initialize WebSocket server first to register ClientManager
const webSocketServer = initWebSocketServer(server);

// Now resolve ChatService (which depends on BrowserToolService → ClientManager)
const chatService = container.resolve<ChatService>(CHAT_SERVICE_TOKEN);

initRoutes(app);

server.listen(PORT, () => {
    logger.info('Server started successfully', {
        service: 'MainServer',
        port: PORT,
        url: `http://127.0.0.1:${PORT}`,
        webSocketEnabled: !!webSocketServer,
        chatServiceEnabled: !!chatService
    });
});