-- Database Schema & Seed Data for FlyRank Task API (PostgreSQL)

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for optimized title searching (used in EXPLAIN ANALYZE comparison)
CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);

-- Seed initial tasks if table is empty
INSERT INTO tasks (title, done)
SELECT 'Learn Express', false
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Learn Express');

INSERT INTO tasks (title, done)
SELECT 'Build CRUD API', false
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Build CRUD API');

INSERT INTO tasks (title, done)
SELECT 'Write tests', true
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Write tests');
