/**
 * Integration tests for WebSocketServer message routing
 */

import http from 'http';
import WebSocket from 'ws';
import { WebSocketServer } from '../src/WebSocketServer';
import { IEventHandler, IHandlerContext, ISocketWrapper, ILogger } from '../src/types';

const makeLogger = (): ILogger => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
});

function waitForMessage(ws: WebSocket): Promise<any> {
    return new Promise((resolve, reject) => {
        const onMessage = (data: WebSocket.Data) => {
            try {
                const parsed = JSON.parse(data.toString());
                cleanup();
                resolve(parsed);
            } catch (err) {
                cleanup();
                reject(err);
            }
        };

        const onError = (err: Error) => {
            cleanup();
            reject(err);
        };

        const cleanup = () => {
            ws.removeListener('message', onMessage as any);
            ws.removeListener('error', onError as any);
        };

        ws.on('message', onMessage as any);
        ws.on('error', onError as any);
    });
}

describe('WebSocketServer integration', () => {
    let server: http.Server;
    let port: number;
    let logger: ILogger;

    beforeEach(done => {
        server = http.createServer();
        server.listen(0, () => {
            // @ts-ignore
            port = (server.address() as any).port;
            logger = makeLogger();
            done();
        });
    });

    afterEach(async () => {
        await new Promise(resolve => server.close(() => resolve(undefined)));
    });

    it('routes valid message to registered handler and returns response', async () => {
        const wss = new WebSocketServer(server, {}, logger);

        // Register echo handler
        class EchoHandler implements IEventHandler<any> {
            readonly eventName = 'echo';
            async handle(socket: ISocketWrapper, data: any, ctx: IHandlerContext) {
                socket.emit('echo_response', { received: data.payload || null, ctxClientId: ctx.clientId });
            }
        }

        wss.registerHandler(new EchoHandler());

        const client = new WebSocket(`ws://127.0.0.1:${port}/`);

        await new Promise<void>((resolve, reject) => {
            client.on('open', () => resolve());
            client.on('error', (err) => reject(err));
        });

        // Send valid message
        const message = { type: 'echo', payload: { hello: 'world' } };
        client.send(JSON.stringify(message));

        const envelope = await waitForMessage(client);

        expect(envelope).toHaveProperty('type', 'echo_response');
        expect(envelope.payload).toMatchObject({ received: message.payload });

        client.close();
        await wss.shutdown();
    });

    it('responds with INVALID_JSON for malformed payload', async () => {
        const wss = new WebSocketServer(server, {}, logger);

        const client = new WebSocket(`ws://127.0.0.1:${port}/`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => resolve());
            client.on('error', (err) => reject(err));
        });

        // Send malformed JSON
        client.send('not-a-json');

        const envelope = await waitForMessage(client);

        expect(envelope).toHaveProperty('type', 'error');
        expect(envelope.payload).toMatchObject({ code: 'INVALID_JSON' });

        client.close();
        await wss.shutdown();
    });

    it('responds with UNKNOWN_MESSAGE_TYPE for unregistered types', async () => {
        const wss = new WebSocketServer(server, {}, logger);

        const client = new WebSocket(`ws://127.0.0.1:${port}/`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => resolve());
            client.on('error', (err) => reject(err));
        });

        client.send(JSON.stringify({ type: 'unknown_type' }));

        const envelope = await waitForMessage(client);

        expect(envelope).toHaveProperty('type', 'error');
        expect(envelope.payload).toMatchObject({ code: 'UNKNOWN_MESSAGE_TYPE' });

        client.close();
        await wss.shutdown();
    });

    it('responds with HANDLER_ERROR when handler throws', async () => {
        const wss = new WebSocketServer(server, {}, logger);

        class ThrowHandler implements IEventHandler<any> {
            readonly eventName = 'boom';
            async handle() {
                throw new Error('handler failed');
            }
        }

        wss.registerHandler(new ThrowHandler());

        const client = new WebSocket(`ws://127.0.0.1:${port}/`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => resolve());
            client.on('error', (err) => reject(err));
        });

        client.send(JSON.stringify({ type: 'boom' }));

        const envelope = await waitForMessage(client);

        expect(envelope).toHaveProperty('type', 'error');
        expect(envelope.payload).toMatchObject({ code: 'HANDLER_ERROR' });

        client.close();
        await wss.shutdown();
    });
});
