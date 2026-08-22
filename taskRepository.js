const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tasksdb';
const pool = new Pool({ connectionString });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient;
try {
  redisClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redisClient.connect().catch(() => {
    // Redis connection optional / fallback
  });
} catch (err) {
  // Graceful fallback if Redis is not running locally
}

// Stage 0: Create table and seed initial tasks in PostgreSQL
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
    `);

    const res = await client.query('SELECT COUNT(*)::int as count FROM tasks');
    if (res.rows[0].count === 0) {
      await client.query(`
        INSERT INTO tasks (title, done) VALUES
          ('Learn Express', false),
          ('Build CRUD API', false),
          ('Write tests', true);
      `);
      console.log('[PostgresRepository] Initialized table and inserted seed data.');
    }
  } finally {
    client.release();
  }
}

// Stage 1: Get all tasks with optional search, filter & sort
async function getAllTasks({ search, done, sort } = {}) {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND title ILIKE $${params.length}`;
  }

  if (done !== undefined) {
    params.push(done === 'true' || done === '1' || done === true);
    query += ` AND done = $${params.length}`;
  }

  if (sort === 'title') {
    query += ' ORDER BY title ASC';
  } else {
    query += ' ORDER BY id ASC';
  }

  const res = await pool.query(query, params);
  return res.rows;
}

// Stage 1: Get single task by ID
async function getTaskById(id) {
  const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return res.rows[0] || null;
}

// Stage 2: Create new task
async function createTask(title) {
  const res = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *',
    [title.trim()]
  );
  return res.rows[0];
}

// Stage 3: Update existing task
async function updateTask(id, { title, done }) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDone = done !== undefined ? Boolean(done) : existing.done;

  const res = await pool.query(
    'UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *',
    [newTitle, newDone, id]
  );
  return res.rows[0];
}

// Stage 3: Delete task
async function deleteTask(id) {
  const res = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] || null;
}

// Optional Extra: Aggregated statistics via SQL
async function getStats() {
  const res = await pool.query(`
    SELECT 
      COUNT(*)::int as total,
      COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0)::int as completed,
      COALESCE(SUM(CASE WHEN NOT done THEN 1 ELSE 0 END), 0)::int as pending
    FROM tasks
  `);
  return res.rows[0];
}

// Stretch Extra: EXPLAIN ANALYZE execution plan
async function explainSearch(term) {
  const res = await pool.query('EXPLAIN ANALYZE SELECT * FROM tasks WHERE title ILIKE $1', [`%${term}%`]);
  return res.rows.map(r => r['QUERY PLAN']);
}

// Stretch Extra: Ping Redis cache
async function pingRedis() {
  if (!redisClient) return 'disabled';
  try {
    const pong = await redisClient.ping();
    return pong; // Should return "PONG"
  } catch (err) {
    return 'unavailable';
  }
}

module.exports = {
  pool,
  initDb,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats,
  explainSearch,
  pingRedis,
};
