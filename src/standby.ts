import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { runQuery } from './engine';
import { log } from 'apify';

function getServerPort(): number {
    const port = process.env.ACTOR_WEB_SERVER_PORT;
    if (!port) {
        throw new Error('Environment variable ACTOR_WEB_SERVER_PORT is not set');
    }
    const parsedPort = Number.parseInt(port, 10);
    if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
        throw new Error(`Invalid port number: ${port}`);
    }
    return parsedPort;
}

function getQueryParamStringValue(req: Request, param: string): string | null {
    const value = req.query[param];
    if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
    }
    return null;
}

export function runStandby() {

    const app = express();

    app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.headers['x-apify-container-server-readiness-probe']) {
            res.status(200).type('text/plain').send('ok');
        } else {
            next();
        }
    });
    
    app.get('/', async (req: Request, res: Response) => {
        const query = getQueryParamStringValue(req, 'query');
        const dataset = getQueryParamStringValue(req, 'dataset');
        const modelName = getQueryParamStringValue(req, 'modelName') || 'openai/gpt-4.1';
        if (!query || !dataset) {
            res.status(400).json({ error: 'Missing required query or dataset parameters' });
            return;
        }
        const response = await runQuery({
            query,
            dataset,
            modelName
        });
        
        if (response) {
            res.status(200).json({ response });
            return;
        }
        res.status(400).json({ error: 'Invalid query or dataset' });
    });

    const port = getServerPort();
    app.listen(port, () => {
        log.info(`Standby server is running on port ${port}`);
    });
}