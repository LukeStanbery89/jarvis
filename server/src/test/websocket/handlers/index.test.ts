import { RegistrationHandler, ChatHandler, BaseHandler, HANDLER_REGISTRY } from '../../../websocket/handlers/index';

describe('WebSocket Handlers Index', () => {
    describe('exports', () => {
        it('should export RegistrationHandler', () => {
            expect(RegistrationHandler).toBeDefined();
        });

        it('should export ChatHandler', () => {
            expect(ChatHandler).toBeDefined();
        });

        it('should export BaseHandler', () => {
            expect(BaseHandler).toBeDefined();
        });
    });

    describe('HANDLER_REGISTRY', () => {
        it('should be defined', () => {
            expect(HANDLER_REGISTRY).toBeDefined();
        });

        it('should map client_registration to RegistrationHandler', () => {
            expect(HANDLER_REGISTRY['client_registration']).toBe('RegistrationHandler');
        });

        it('should map chat_message to ChatHandler', () => {
            expect(HANDLER_REGISTRY['chat_message']).toBe('ChatHandler');
        });

        it('should map ping to PingHandler', () => {
            expect(HANDLER_REGISTRY['ping']).toBe('PingHandler');
        });

        it('should be a readonly constant', () => {
            // This tests the typing - the const assertion makes it readonly
            expect(typeof HANDLER_REGISTRY).toBe('object');
            expect(Object.keys(HANDLER_REGISTRY)).toEqual(['client_registration', 'chat_message', 'ping']);
        });

        it('should have string values', () => {
            Object.values(HANDLER_REGISTRY).forEach(value => {
                expect(typeof value).toBe('string');
            });
        });

        it('should have expected event names as keys', () => {
            const keys = Object.keys(HANDLER_REGISTRY);
            expect(keys).toContain('client_registration');
            expect(keys).toContain('chat_message');
            expect(keys).toContain('ping');
            expect(keys).toHaveLength(3);
        });
    });
});