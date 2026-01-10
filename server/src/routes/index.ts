import { Application } from 'express';
import { container } from '../container';
import { HealthController } from '../controllers/HealthController';
import { SummarizeController } from '../controllers/SummarizeController';

export function initRoutes(app: Application): void {
    const healthController = new HealthController();
    const summarizeController = container.resolve(SummarizeController);

    app.get('/health', (req, res) => healthController.getHealth(req, res));
    app.post('/api/summarize', (req, res) => summarizeController.summarize(req, res));
}