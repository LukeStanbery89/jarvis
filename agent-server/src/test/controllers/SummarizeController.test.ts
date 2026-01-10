import { Request, Response } from 'express';
import { SummarizeController } from '../../controllers/SummarizeController';

// Mock the ChatOpenAI
const mockInvoke = jest.fn();
jest.mock('@langchain/openai', () => ({
    ChatOpenAI: jest.fn().mockImplementation(() => ({
        invoke: mockInvoke
    }))
}));

describe('SummarizeController', () => {
    let summarizeController: SummarizeController;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        summarizeController = new SummarizeController();
        mockRequest = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        mockResponse = {
            json: jsonMock,
            status: statusMock
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('summarize', () => {
        it('should successfully generate summary', async () => {
            mockInvoke.mockResolvedValue({
                content: 'This is a summary of the content.'
            });

            mockRequest.body = {
                content: 'This is some long content that needs to be summarized.',
                title: 'Test Article'
            };

            await summarizeController.summarize(mockRequest as Request, mockResponse as Response);

            expect(mockInvoke).toHaveBeenCalledWith([
                {
                    role: 'user',
                    content: expect.stringContaining('Please provide a concise summary')
                }
            ]);

            expect(jsonMock).toHaveBeenCalledWith({
                summary: 'This is a summary of the content.',
                title: 'Test Article',
                timestamp: expect.any(String)
            });
        });

        it('should generate summary without title', async () => {
            mockInvoke.mockResolvedValue({
                content: 'Summary without title.'
            });

            mockRequest.body = {
                content: 'Content without title.'
            };

            await summarizeController.summarize(mockRequest as Request, mockResponse as Response);

            expect(jsonMock).toHaveBeenCalledWith({
                summary: 'Summary without title.',
                title: 'Untitled',
                timestamp: expect.any(String)
            });
        });

        it('should return 400 error when content is missing', async () => {
            mockRequest.body = {};

            await summarizeController.summarize(mockRequest as Request, mockResponse as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                error: 'Content is required'
            });
        });

        it('should handle AI service errors', async () => {
            mockInvoke.mockRejectedValue(new Error('AI service error'));

            mockRequest.body = {
                content: 'Test content'
            };

            await summarizeController.summarize(mockRequest as Request, mockResponse as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                error: 'Failed to generate summary',
                details: 'AI service error'
            });
        });

        it('should handle empty content string', async () => {
            mockRequest.body = {
                content: ''
            };

            await summarizeController.summarize(mockRequest as Request, mockResponse as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                error: 'Content is required'
            });
        });
    });
});