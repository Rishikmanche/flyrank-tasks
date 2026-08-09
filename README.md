# Task API — Persistent SQLite Backend

A lightweight, production-grade CRUD REST API for managing tasks, built with **Node.js**, **Express.js**, and **SQLite (`better-sqlite3`)**.

---

## 💡 Overview & Architecture: In-Memory vs. Database Persistence

In earlier iterations, tasks were stored in an in-memory array (`let tasks = [...]`), meaning all data was lost whenever the server restarted (the **mortality experiment**).

In this version, the storage layer has been upgraded to **SQLite (`tasks.db`)**. The API interface remains 100% identical and backwards-compatible, but data is now permanently persisted across server restarts.

```
Client -> Express REST API -> SQLite Database (tasks.db)
```

### Why SQLite Was Chosen
1. **Zero Configuration**: SQLite stores the entire database in a single file (`tasks.db`) on disk without requiring an external database server daemon (like Postgres or MySQL).
2. **Deterministic & Fast**: Embedded C-level SQLite via `better-sqlite3` executes synchronous, highly optimized queries in sub-millisecond time.
3. **Automatic Lifecycle**: The database and `tasks` table are automatically created upon application startup if they do not exist.

---

## 🚀 How to Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the Express & SQLite server
node index.js
```

Server starts at: `http://localhost:3000`  
Swagger UI Interactive API Docs: `http://localhost:3000/docs`

---

## 🗄️ Database Details

- **Database File:** `tasks.db` (created automatically in the project root directory)
- **Table Schema:**
  ```sql
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  );
  ```
- **Seed Data:** When the server starts for the first time on an empty database, it automatically seeds 3 example tasks:
  1. `Learn Express` (done: `false` / `0`)
  2. `Build CRUD API` (done: `false` / `0`)
  3. `Write tests` (done: `true` / `1`)

---

## 🔍 Database Viewer & SQL Exploration (Stage 4)

You can inspect and query `tasks.db` using any SQLite viewer (e.g. **DB Browser for SQLite** or VS Code SQLite Viewer extension).

![DB Browser for SQLite Screenshot](./sqlite_db_viewer.jpg)

### Executed SQL Queries

```sql
-- 1. List every task
SELECT * FROM tasks;

-- 2. Show only completed tasks
SELECT * FROM tasks WHERE done = 1;

-- 3. Count total number of tasks
SELECT COUNT(*) FROM tasks;

-- 4. Mark all tasks as completed
UPDATE tasks SET done = 1;

-- 5. Delete all completed tasks
DELETE FROM tasks WHERE done = 1;

-- 6. Search tasks containing a keyword (case-insensitive substring)
SELECT * FROM tasks WHERE title LIKE '%Express%';
```

---

## 📡 API Endpoints

| Method | Endpoint | Description | Status Codes | Query Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | API Metadata & persistent database status | `200` | — |
| **GET** | `/health` | Healthcheck endpoint with DB connection check | `200` | — |
| **GET** | `/tasks` | List all tasks (supports search, filter, and sorting) | `200` | `?search=term`, `?done=true/false`, `?sort=title` |
| **GET** | `/tasks/:id` | Get single task by integer ID | `200`, `404` | — |
| **POST** | `/tasks` | Create a new task (persisted to SQLite) | `201`, `400` | — |
| **PUT** | `/tasks/:id` | Update task title and/or done status | `200`, `400`, `404` | — |
| **DELETE** | `/tasks/:id` | Delete a task from SQLite | `204`, `404` | — |
| **GET** | `/stats` | Task statistics aggregated via SQL `COUNT` & `SUM` | `200` | — |
| **GET** | `/docs` | Interactive Swagger UI documentation | `200` | — |

---

## 🧪 Example curl Output

```bash
# 1. Create a task in SQLite
$ curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Persist data in SQLite"}'

HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":4,"title":"Persist data in SQLite","done":false}

# 2. Verify task persisted after server restart
$ curl -s http://localhost:3000/tasks/4
{"id":4,"title":"Persist data in SQLite","done":false}
```

---

## 🛠️ Tech Stack
- **Runtime:** Node.js (CommonJS)
- **Framework:** Express.js
- **Database:** SQLite3 (`better-sqlite3`)
- **Documentation:** OpenAPI 3.0 / `swagger-ui-express`
