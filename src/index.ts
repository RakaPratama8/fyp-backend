import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import { connectRedis } from './redisClient';
import { authRouter } from './auth';
import { searchRouter } from './search';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/search', searchRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const startServer = async () => {
    try {
        await initDb();
        await connectRedis();
        
        app.listen(PORT, () => {
            console.log(`Backend Gateway running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
