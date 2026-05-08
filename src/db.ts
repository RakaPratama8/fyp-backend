import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'fyp_user',
  password: process.env.DB_PASSWORD || 'fyp_password',
  database: process.env.DB_NAME || 'fyp_db',
});

// Create Users table layout if it doesn't exist
export const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('User table initialized');
  } catch (err) {
    console.error('Error initializing user table', err);
  } finally {
    client.release();
  }
};

export default pool;
