const express = require("express");
const swaggerUi = require("swagger-ui-express");
const Database = require("better-sqlite3");
const path = require("path");
const openapiDoc = require("./openapi.json");

const app = express();
const PORT = 3000;

// Initialize SQLite Database
const dbPath = path.join(__dirname, "tasks.db");
const db = new Database(dbPath);

// Enable WAL mode for performance
db.pragma("journal_mode = WAL");

// Stage 0: Create table if missing and seed initial data
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

const countResult = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
if (countResult.count === 0) {
  const insertSeed = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const seedTransaction = db.transaction(() => {
    insertSeed.run("Learn Express", 0);
    insertSeed.run("Build CRUD API", 0);
    insertSeed.run("Write tests", 1);
  });
  seedTransaction();
  console.log("Database initialized with seed tasks.");
}

// Helper to format SQLite rows into JSON API format (converting integer 0/1 to boolean)
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
  };
}

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "2.0 (SQLite Persistent)",
    database: "SQLite (tasks.db)",
    endpoints: ["/tasks", "/tasks/:id", "/stats", "/docs"],
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", database: "connected" });
});

// Stage 1 + Extras: List all tasks with optional search, filter & sort
app.get("/tasks", (req, res) => {
  const { search, done, sort } = req.query;
  let query = "SELECT * FROM tasks WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND title LIKE ?";
    params.push(`%${search}%`);
  }

  if (done !== undefined) {
    query += " AND done = ?";
    params.push(done === "true" || done === "1" ? 1 : 0);
  }

  if (sort === "title") {
    query += " ORDER BY title ASC";
  } else {
    query += " ORDER BY id ASC";
  }

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(formatTask));
});

// Stage 1: Get single task by ID
app.get("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!row) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.json(formatTask(row));
});

// Stage 2: Create new task (Persisted in SQLite)
app.post("/tasks", (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "Title is required and must be a non-empty string" });
  }

  const stmt = db.prepare("INSERT INTO tasks (title, done) VALUES (?, 0)");
  const info = stmt.run(title.trim());

  const createdRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(formatTask(createdRow));
});

// Stage 3: Update task in SQLite
app.put("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body;
  let newTitle = existing.title;
  let newDone = existing.done;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }
    newTitle = title.trim();
  }

  if (done !== undefined) {
    if (typeof done !== "boolean") {
      return res.status(400).json({ error: "Done must be a boolean" });
    }
    newDone = done ? 1 : 0;
  }

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(newTitle, newDone, id);

  const updatedRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.json(formatTask(updatedRow));
});

// Stage 3: Delete task from SQLite
app.delete("/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  res.status(204).send();
});

// Extra: Statistics using SQL COUNT & SUM
app.get("/stats", (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) as pending
    FROM tasks
  `).get();

  res.json({
    total: stats.total || 0,
    completed: stats.completed || 0,
    pending: stats.pending || 0,
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, db };
