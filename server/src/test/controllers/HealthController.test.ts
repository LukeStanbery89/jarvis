import { Request, Response } from 'express';
import { HealthController } from '../../controllers/HealthController';

describe('HealthController', () => {
    let healthController: HealthController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        healthController = new HealthController();
        mockRequest = {};
        jsonMock = jest.fn();
        mockResponse = {
            json: jsonMock
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getHealth', () => {
        it('should return health status with OK and timestamp', () => {
            const mockDate = '2024-01-01T00:00:00.000Z';
            jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

            healthController.getHealth(mockRequest as Request, mockResponse as Response);

            expect(jsonMock).toHaveBeenCalledWith({
                status: 'OK',
                timestamp: mockDate
            });
        });

        it('should return current timestamp', () => {
            const beforeCall = new Date().toISOString();
            
            healthController.getHealth(mockRequest as Request, mockResponse as Response);
            
            const afterCall = new Date().toISOString();
            const responseCall = jsonMock.mock.calls[0][0];

            expect(responseCall.status).toBe('OK');
            expect(responseCall.timestamp).toBeDefined();
            expect(responseCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            
            // Timestamp should be between before and after the call
            expect(new Date(responseCall.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeCall).getTime());
            expect(new Date(responseCall.timestamp).getTime()).toBeLessThanOrEqual(new Date(afterCall).getTime());
        });
    });
});