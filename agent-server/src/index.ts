import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initWebSocketServer } from './websocket';
import { setupContainer, container } from './container';
import { initRoutes } from './routes';
import { ChatService, CHAT_SERVICE_TOKEN } from './services/ChatService';
import { logger } from './utils/logger';

// Import WebSocket services for singleton registration
import { ClientManager } from './websocket/ClientManager';
import { AuthenticationService } from './services/AuthenticationService';

dotenv.config();

// Setup dependency injection container
setupContainer();

// Register WebSocket services as singletons
container.registerSingleton(ClientManager);
container.registerSingleton(AuthenticationService);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = createServer(app);
const chatService = container.resolve<ChatService>(CHAT_SERVICE_TOKEN);

initRoutes(app);
const webSocketServer = initWebSocketServer(server);

server.listen(PORT, () => {
    logger.info('Server started successfully', {
        service: 'MainServer',
        port: PORT,
        url: `http://127.0.0.1:${PORT}`,
        webSocketEnabled: !!webSocketServer,
        chatServiceEnabled: !!chatService
    });
});