import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import redisClient from './redisClient';

export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_do_not_use_in_prod';
const RATE_LIMIT_SEC = 60;
const MAX_REQUESTS = 20;

// Middleware to protect routes via JWT
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            (req as any).user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Rate limiting middleware per authenticated user
export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.id) return res.sendStatus(401);
    
    const key = `ratelimit:${user.id}`;
    
    try {
        const requests = await redisClient.incr(key);
        if (requests === 1) {
            await redisClient.expire(key, RATE_LIMIT_SEC);
        }
        
        if (requests > MAX_REQUESTS) {
            return res.status(429).json({ error: "Too many requests. Please try again later." });
        }
        next();
    } catch (e) {
        // Fail open if Redis crashes
        next();
    }
};

authRouter.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, hash]
        );
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        if (error.code === '23505') { // Unique violation logic
            return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        if (user && await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, user: { id: user.id, email: user.email } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
