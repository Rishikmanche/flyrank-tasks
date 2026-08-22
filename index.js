const express = require("express");
const swaggerUi = require("swagger-ui-express");
const repo = require("./taskRepository");
const openapiDoc = require("./openapi.json");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

// Initialize Database Connection
repo.initDb().catch((err) => {
  console.error("Failed to initialize PostgreSQL database:", err);
});

app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "3.0 (PostgreSQL & Docker)",
    architecture: "Decoupled Repository Pattern",
    endpoints: ["/tasks", "/tasks/:id", "/stats", "/health", "/docs"],
  });
});

app.get("/health", async (req, res) => {
  const redisStatus = await repo.pingRedis();
  res.json({
    status: "ok",
    database: "postgresql",
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

// Stage 1 + Extras: List all tasks with search, filter, sort
app.get("/tasks", async (req, res) => {
  try {
    const { search, done, sort } = req.query;
    const tasks = await repo.getAllTasks({ search, done, sort });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Database query error", details: err.message });
  }
});

// Stage 1: Get single task by ID
app.get("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const task = await repo.getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: "Database query error", details: err.message });
  }
});

// Stage 2: Create new task (Persisted in PostgreSQL)
app.post("/tasks", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }

    const newTask = await repo.createTask(title);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: "Database insertion error", details: err.message });
  }
});

// Stage 3: Update task in PostgreSQL
app.put("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const { title, done } = req.body;
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }
    if (done !== undefined && typeof done !== "boolean") {
      return res.status(400).json({ error: "Done must be a boolean" });
    }

    const updatedTask = await repo.updateTask(id, { title, done });
    if (!updatedTask) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: "Database update error", details: err.message });
  }
});

// Stage 3: Delete task from PostgreSQL
app.delete("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const deleted = await repo.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Database deletion error", details: err.message });
  }
});

// Extra: Statistics endpoint
app.get("/stats", async (req, res) => {
  try {
    const stats = await repo.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Database stats error", details: err.message });
  }
});

// Stretch Extra: EXPLAIN ANALYZE query plan
app.get("/explain", async (req, res) => {
  try {
    const term = req.query.term || "Express";
    const plan = await repo.explainSearch(term);
    res.json({ term, query_plan: plan });
  } catch (err) {
    res.status(500).json({ error: "Explain error", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, repo };
