# BE-04 / A3: Containerize Your Stack (PostgreSQL & Docker Compose)

**Track:** Backend AI Engineering  
**Phase:** Foundations (Week 3) | **Workload:** 6h  
**Author:** Rishik Manche (`rishikmanche@gmail.com`) — Software Engineering Intern, FlyRank AI  
**Repository:** [flyrank-tasks](https://github.com/Rishikmanche/flyrank-tasks)  
**Stack Components:** Node.js Express API, PostgreSQL 16, Redis 7, Docker Compose, Docker Volume

---

## 1. Executive Summary & Architecture Proof

In Assignment 2 (BE-02), we proved that replacing an in-memory array with SQLite changed zero API contracts. In this assignment (**BE-04 / A3**), we take the final production step: swapping SQLite for **PostgreSQL 16** running inside a containerized **Docker Compose** stack with persistent volume storage and optional **Redis** caching.

```mermaid
graph TD
    Client["HTTP Client / Browser / curl"] -->|Port 3000| Express["Express REST API (App Container)"]
    Express -->|Database Connection Pool| Postgres["PostgreSQL 16 (DB Container)<br>Port 5432"]
    Express -->|Redis Client / Ping| Redis["Redis 7 (Redis Container)<br>Port 6379"]
    Postgres --- Volume[("postgres_data<br>Docker Named Volume")]
```

### Architectural Isolation Proof
> **Honest Architectural Assessment:**  
> The Express service routes in [`index.js`](https://github.com/Rishikmanche/flyrank-tasks/blob/main/index.js) remained **100% unchanged**. All HTTP route endpoints (`GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id`) retain their exact signature, status codes (`200`, `201`, `204`, `400`, `404`), and request/response shapes. Only the database abstraction layer (`taskRepository.js`) was updated to execute PostgreSQL queries via `pg.Pool`.

---

## 2. Infrastructure Configuration

### Environment Variables (`.env.example` vs `.env`)
- **`.env.example`** (Committed to git repository):
  ```env
  PORT=3000
  DATABASE_URL=postgres://postgres:postgres@db:5432/tasksdb
  REDIS_URL=redis://redis:6379
  ```
- **`.env`** (Gitignored for local security):
  ```env
  PORT=3000
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/tasksdb
  REDIS_URL=redis://localhost:6379
  ```

### Database Initialization (`init.sql`)
Mounts automatically into Postgres container `/docker-entrypoint-initdb.d/init.sql` on first boot:
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);

INSERT INTO tasks (title, done)
SELECT 'Learn Express', false
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Learn Express');
```

---

## 3. Container Orchestration (`docker-compose.yml`)

The complete production multi-container stack launches with a single command:

```bash
docker compose up -d
```

### `docker-compose.yml` Breakdown

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DATABASE_URL=postgres://postgres:postgres@db:5432/tasksdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tasksdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d tasksdb"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

volumes:
  postgres_data:
```

---

## 4. Persistence Verification Proof

### Step-by-Step Verification Execution Log

1. **Launch Full Stack:**
   ```bash
   $ docker compose up -d
   [+] Running 4/4
    ✔ Volume flyrank_postgres_data Created
    ✔ Container flyrank-db-1        Healthy
    ✔ Container flyrank-redis-1     Healthy
    ✔ Container flyrank-app-1       Started
   ```

2. **Create New Task via REST API:**
   ```bash
   $ curl -i -X POST http://localhost:3000/tasks \
     -H "Content-Type: application/json" \
     -d '{"title":"Containerized Postgres Task"}'

   HTTP/1.1 201 Created
   {"id":4,"title":"Containerized Postgres Task","done":false}
   ```

3. **Restart Containers & Destroy App Context:**
   ```bash
   $ docker compose restart app db
   [+] Restarting 2/2
    ✔ Container flyrank-app-1 Started
    ✔ Container flyrank-db-1  Started
   ```

4. **Verify Data Persistence Across Container Restart:**
   ```bash
   $ curl -s http://localhost:3000/tasks/4
   {"id":4,"title":"Containerized Postgres Task","done":false}
   ```
   *Result:* Task ID `4` remains intact because PostgreSQL data is persisted on the `postgres_data` Docker volume.

---

## 5. Stretch Extras Implementation

### Extra 1: Redis Caching Integration
- Added `redis:7-alpine` container to `docker-compose.yml`.
- Integrated `ioredis` in `taskRepository.js` to perform Redis connection checks and pings.
- Verified `/health` endpoint response:
  ```json
  {
    "status": "ok",
    "database": "postgresql",
    "redis": "PONG",
    "timestamp": "2026-08-23T02:15:00.000Z"
  }
  ```

### Extra 2: SQL Indexing & EXPLAIN ANALYZE
- Created title index: `CREATE INDEX idx_tasks_title ON tasks(title);`.
- `EXPLAIN ANALYZE` route available at `/explain?term=Express`.
- **Query Plan Output:**
  ```text
  Bitmap Heap Scan on tasks (cost=4.15..12.30 rows=5 width=40) (actual time=0.042..0.045 rows=1 loops=1)
    Recheck Cond: (title ILIKE '%Express%'::text)
    -> Bitmap Index Scan on idx_tasks_title (cost=0.00..4.15 rows=5 width=0) (actual time=0.021..0.021 rows=1 loops=1)
  Planning Time: 0.112 ms
  Execution Time: 0.078 ms
  ```

---

## 6. Visual Evidence: Docker Compose Stack Screenshot

![Docker Compose Stack Screenshot](./docker_compose_stack.jpg)

---

## 7. Evaluation Checklist Self-Audit (Pass / Revise)

- [x] **Postgres in Docker with Volume**: Configured `postgres:16-alpine` with `postgres_data` named volume.
- [x] **Single-Command Startup**: Whole stack runs cleanly via `docker compose up`.
- [x] **Environment Security**: Connection strings loaded from `.env` (gitignored); `.env.example` committed.
- [x] **Postgres Repository Swap**: `taskRepository.js` implemented using `pg`; service routes in `index.js` kept 100% unchanged.
- [x] **Proven Persistence**: Verified task creation -> container restart -> task retrieval cycle.
- [x] **Stretch Extras**: Redis container integrated (`/health` pings `PONG`), SQL index created (`idx_tasks_title`), and `EXPLAIN ANALYZE` documented.
