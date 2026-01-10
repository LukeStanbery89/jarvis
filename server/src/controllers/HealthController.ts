import { Request, Response } from 'express';

export class HealthController {
    getHealth(req: Request, res: Response): void {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    }
}