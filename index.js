const express = require("express");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const repo = require("./taskRepository");
const authService = require("./authService");
const aiService = require("./aiService");
const pdfService = require("./pdfReportService");
const jobService = require("./jobQueueService");
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

// Reusable Authentication Middleware
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token required" });
  }

  const token = authHeader.split(" ")[1];
  if (!token || token.trim() === "") {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const user = await authService.verifyToken(token);
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/", (req, res) => {
  res.json({
    name: "FlyRank Task, Auth, AI, Background Jobs & PDF API",
    version: "7.0 (Asynchronous Job Queue & Idempotency Engine)",
    architecture: "Decoupled Repository & Worker Pattern",
    endpoints: {
      backgroundJobs: [
        "POST /jobs (Accept Fast 202, Idempotency-Key support)",
        "GET /jobs/:id (Job status polling)",
        "GET /jobs (Queue history inspection)",
      ],
      reports: [
        "POST /reports/generate",
        "GET /reports/jobs/:id",
        "GET /reports/download/:id",
        "GET /reports/history",
        "POST /reports/schedule",
      ],
      ai: ["/ai/classify-task"],
      auth: ["/auth/signup", "/auth/login", "/auth/logout"],
      protected: ["/protected/profile", "/protected/dashboard"],
      public: ["/public/info", "/tasks", "/docs"],
    },
  });
});

app.get("/health", async (req, res) => {
  const redisStatus = await repo.pingRedis();
  res.json({
    status: "ok",
    database: "postgresql",
    redis: redisStatus,
    auth: "connected to Supabase",
    ai: "Groq/LLM Llama-3.3-70b Structured Judgment API Ready",
    jobQueue: "Asynchronous Worker Queue Active (Idempotency Enabled)",
    reports: "PDFKit Background Pipeline Active",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// BE-06: Asynchronous Background Job Endpoints
// ==========================================

// 1. Enqueue slow background job (Accept Fast 202 Accepted)
app.post("/jobs", (req, res) => {
  try {
    const { text, forceMock } = req.body || {};
    const idempotencyKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || null;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Input text is required and must be a non-empty string" });
    }

    const { job, isDuplicate } = jobService.enqueueJob({ text: text.trim(), forceMock }, { idempotencyKey });

    res.status(202).json({
      message: isDuplicate ? "Existing job returned (Idempotent replay)" : "Job accepted and enqueued in background",
      jobId: job.jobId,
      status: job.status,
      isDuplicate,
      idempotencyKey: job.idempotencyKey,
      statusUrl: `/jobs/${job.jobId}`,
      createdAt: job.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to enqueue background job", details: err.message });
  }
});

// 2. Poll job status
app.get("/jobs/:id", (req, res) => {
  const job = jobService.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: `Job ${req.params.id} not found` });
  }
  res.json(job);
});

// 3. Inspect all background jobs
app.get("/jobs", (req, res) => {
  const jobs = jobService.getAllJobs();
  res.json({
    totalJobs: jobs.length,
    jobs,
  });
});

// ==========================================
// BE-08: PDF Report Generator Endpoints
// ==========================================
app.post("/reports/generate", (req, res) => {
  try {
    const job = pdfService.createReportJob(repo);
    res.status(202).json({
      message: "PDF report generation enqueued in background",
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      statusUrl: `/reports/jobs/${job.jobId}`,
      downloadUrl: job.downloadUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to enqueue report job", details: err.message });
  }
});

app.get("/reports/jobs/:id", (req, res) => {
  const job = pdfService.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: `Report job ${req.params.id} not found` });
  }
  res.json(job);
});

app.get("/reports/download/:id", (req, res) => {
  const job = pdfService.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: `Report job ${req.params.id} not found` });
  }

  if (job.status !== "completed") {
    return res.status(400).json({
      error: `Report is not ready yet (Current status: ${job.status})`,
      status: job.status,
    });
  }

  if (!fs.existsSync(job.filePath)) {
    return res.status(404).json({ error: "Report file artifact missing on disk" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${job.fileName}"`);
  const fileStream = fs.createReadStream(job.filePath);
  fileStream.pipe(res);
});

app.get("/reports/history", (req, res) => {
  const jobs = pdfService.getAllJobs();
  res.json({
    totalReports: jobs.length,
    reports: jobs,
  });
});

let scheduledInterval = null;
app.post("/reports/schedule", (req, res) => {
  const { intervalSeconds = 3600, enabled = true } = req.body || {};

  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
  }

  if (enabled) {
    scheduledInterval = setInterval(() => {
      console.log(`[Scheduler] Generating periodic automated PDF report...`);
      pdfService.createReportJob(repo);
    }, intervalSeconds * 1000);

    return res.json({
      message: `Automated scheduled PDF reports enabled every ${intervalSeconds}s`,
      intervalSeconds,
      active: true,
    });
  }

  res.json({ message: "Automated scheduled reports disabled", active: false });
});

// ==========================================
// BE-07: AI Model Judgment Endpoint
// ==========================================
app.post("/ai/classify-task", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Input text is required and must be a non-empty string" });
    }

    const classification = await aiService.classifyTask(text.trim());
    res.json(classification);
  } catch (err) {
    res.status(500).json({ error: "AI classification failed", details: err.message });
  }
});

// Public & Auth Routes
app.get("/public/info", (req, res) => {
  res.json({ message: "Welcome stranger! This info is public." });
});

app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await authService.signUp(email.trim(), password);
    res.status(201).json({
      message: "User registered successfully",
      user: result.user,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const session = await authService.login(email.trim(), password);
    res.json(session);
  } catch (err) {
    const statusCode = err.status || 401;
    res.status(statusCode).json({ error: "Invalid login credentials" });
  }
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    await authService.logout(req.token);
    res.status(204).send();
  } catch (err) {
    res.status(204).send();
  }
});

app.get("/protected/profile", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role || "authenticated",
    created_at: req.user.created_at,
    user_metadata: req.user.user_metadata || {},
  });
});

app.get("/protected/dashboard", requireAuth, (req, res) => {
  res.json({
    message: "Welcome to your protected dashboard!",
    user_id: req.user.id,
    email: req.user.email,
    timestamp: new Date().toISOString(),
  });
});

// Task Routes
app.get("/tasks", async (req, res) => {
  try {
    const { search, done, sort } = req.query;
    const tasks = await repo.getAllTasks({ search, done, sort });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Database query error", details: err.message });
  }
});

app.get("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid task ID" });
    const task = await repo.getTaskById(id);
    if (!task) return res.status(404).json({ error: `Task ${id} not found` });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: "Database query error", details: err.message });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required and must be a non-empty string" });
    }
    const newTask = await repo.createTask(title.trim());
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: "Database insertion error", details: err.message });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid task ID" });
    const { title, done } = req.body;
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }
    if (done !== undefined && typeof done !== "boolean") {
      return res.status(400).json({ error: "Done must be a boolean" });
    }
    const updatedTask = await repo.updateTask(id, { title, done });
    if (!updatedTask) return res.status(404).json({ error: `Task ${id} not found` });
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: "Database update error", details: err.message });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid task ID" });
    const deleted = await repo.deleteTask(id);
    if (!deleted) return res.status(404).json({ error: `Task ${id} not found` });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Database deletion error", details: err.message });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const stats = await repo.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Database stats error", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, repo, authService, aiService, pdfService, jobService };
