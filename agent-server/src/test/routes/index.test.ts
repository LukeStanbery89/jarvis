import { Application } from 'express';
import { container } from '../../container';
import { initRoutes } from '../../routes/index';
import { HealthController } from '../../controllers/HealthController';
import { SummarizeController } from '../../controllers/SummarizeController';

// Mock dependencies
jest.mock('../../container');
jest.mock('../../controllers/HealthController');
jest.mock('../../controllers/SummarizeController');

describe('Routes', () => {
    let mockApp: Partial<Application>;
    let mockHealthController: jest.Mocked<HealthController>;
    let mockSummarizeController: jest.Mocked<SummarizeController>;
    let mockContainer: jest.Mocked<typeof container>;

    beforeEach(() => {
        // Create mock app
        mockApp = {
            get: jest.fn(),
            post: jest.fn(),
        };

        // Create mock controllers
        mockHealthController = {
            getHealth: jest.fn(),
        } as unknown as jest.Mocked<HealthController>;

        mockSummarizeController = {
            summarize: jest.fn(),
        } as unknown as jest.Mocked<SummarizeController>;

        // Mock container
        mockContainer = container as jest.Mocked<typeof container>;
        mockContainer.resolve = jest.fn().mockReturnValue(mockSummarizeController);

        // Mock constructor
        (HealthController as jest.MockedClass<typeof HealthController>).mockImplementation(() => mockHealthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initRoutes', () => {
        it('should initialize health route', () => {
            initRoutes(mockApp as Application);

            expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
        });

        it('should initialize summarize route', () => {
            initRoutes(mockApp as Application);

            expect(mockApp.post).toHaveBeenCalledWith('/api/summarize', expect.any(Function));
        });

        it('should create HealthController instance', () => {
            initRoutes(mockApp as Application);

            expect(HealthController).toHaveBeenCalledTimes(1);
        });

        it('should resolve SummarizeController from container', () => {
            initRoutes(mockApp as Application);

            expect(mockContainer.resolve).toHaveBeenCalledWith(SummarizeController);
        });

        it('should call healthController.getHealth when health route is accessed', () => {
            initRoutes(mockApp as Application);

            // Get the callback function passed to app.get
            const getHealthCallback = (mockApp.get as jest.Mock).mock.calls[0][1];
            
            const mockReq = {};
            const mockRes = {};
            
            getHealthCallback(mockReq, mockRes);

            expect(mockHealthController.getHealth).toHaveBeenCalledWith(mockReq, mockRes);
        });

        it('should call summarizeController.summarize when summarize route is accessed', () => {
            initRoutes(mockApp as Application);

            // Get the callback function passed to app.post
            const summarizeCallback = (mockApp.post as jest.Mock).mock.calls[0][1];
            
            const mockReq = {};
            const mockRes = {};
            
            summarizeCallback(mockReq, mockRes);

            expect(mockSummarizeController.summarize).toHaveBeenCalledWith(mockReq, mockRes);
        });
    });
});