import { logger } from '@jarvis/server-utils';
import { IHttpClient } from '../../musicbrainz/interfaces/IMusicBrainzServices';

/**
 * HTTP client implementation using fetch API
 * This provides a mockable interface for HTTP requests
 */
export class FetchHttpClient implements IHttpClient {
    async get(url: string, options?: { headers?: Record<string, string>; }): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        json(): Promise<any>;
    }> {
        logger.debug("FetchHttpClient - GET", { url });
        const response = await fetch(url, {
            method: 'GET',
            headers: options?.headers || {}
        });

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            json: () => response.json()
        };
    }

    async post(url: string, body: any, options?: { headers?: Record<string, string>; }): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        json(): Promise<any>;
    }> {
        logger.debug("FetchHttpClient - POST", { url });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(options?.headers || {})
            },
            body: JSON.stringify(body)
        });

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            json: () => response.json()
        };
    }
}