import express from 'express';
import redisClient from './redisClient';
import { authenticateJWT, rateLimiter } from './auth';
import type { Request, Response } from 'express';

// Cannot use standard 'import' because it's a raw script import strategy without module interop or fetch
export const searchRouter = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

searchRouter.get('/', authenticateJWT, rateLimiter, async (req: Request, res: Response) => {
    const userQuery = req.query.q as string || '';
    const _minYear = req.query.years ? parseInt(req.query.years as string) : 5;
    const minYear = new Date().getFullYear() - _minYear;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!userQuery) {
        return res.status(400).json({ error: "Missing query 'q'" });
    }

    // Cache lookup logic
    const cacheKey = `search:${userQuery.toLowerCase().trim()}:y${minYear}:l${limit}`;
    
    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json({ query: userQuery, results: JSON.parse(cachedData), cached: true });
        }

        // Forward to AI service utilizing Node's built in fetch
        const aiResponse = await fetch(`${AI_SERVICE_URL}/internals/semantic-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: userQuery,
                min_year: minYear,
                top_k: limit
            })
        });

        if (!aiResponse.ok) {
            const errBody = await aiResponse.text();
            throw new Error(`AI Service Failed: ${errBody}`);
        }

        const data = await aiResponse.json();
        
        // Save to cache with TTL
        await redisClient.setEx(cacheKey, 60 * 60 * 24, JSON.stringify(data));

        return res.json({ query: userQuery, results: data, cached: false });

    } catch (err: any) {
        console.error("Search Gateway Error:", err);
        return res.status(500).json({ error: 'Search failed in downstream service' });
    }
});
