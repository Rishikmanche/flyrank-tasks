# FlyRank AI Engineering Capstone & Microservices Monorepo

**Author:** Rishik Manche (`rishikmanche@gmail.com`) — Software Engineering Intern, FlyRank AI  
**Repository:** [https://github.com/Rishikmanche/flyrank-tasks](https://github.com/Rishikmanche/flyrank-tasks)  
**Live Portfolio & Demo:** [https://rishikmanche.github.io/flyrank-tasks/](https://rishikmanche.github.io/flyrank-tasks/)  
**Credential Verification:** [https://internship.flyrank.ai/verify/rishik-manche](https://internship.flyrank.ai/verify/rishik-manche)

---

## 1. What This Project Is & For Whom

This repository contains the complete production-grade backend engineering capstone and microservices suite built during the **FlyRank AI Internship Program** (General AI Fluency & Backend AI Engineering tracks).

It serves engineering teams, hiring managers, and developers looking for:
1. **Self-Healing Backend Debugger Agent ("PatchBot"):** An autonomous ReAct agent with Model Context Protocol (MCP) integrations that detects API crashes, isolates git fix branches, patches code, runs unit tests, and opens pull requests with human-in-the-loop verification.
2. **Structured AI Model Judgment API:** Single-purpose Express endpoints (`POST /ai/classify-task`) returning strict, Zod-validated JSON rather than unpredictable chatbot text.
3. **Asynchronous Background Processing & PDF Pipeline:** Accept-fast (`202 Accepted`) job queues with `Idempotency-Key` deduplication, automatic retries, and vector PDF report generation (`PDFKit`).
4. **Visual AI Workflow System:** Next.js 14 + React Flow + Inngest flow canvas for branching binary YES/NO decision trees.

---


## 3. Quick Start: Reproducible Setup in 3 Minutes

A stranger can clone and run this entire environment from scratch with zero configuration:

### Prerequisites
- Node.js 18+ installed (`node -v`)
- Git installed (`git -v`)
- Docker (optional for full containerized PostgreSQL + Redis stack)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/Rishikmanche/flyrank-tasks.git
cd flyrank-tasks
npm install
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env
```
*(The repository includes a ready-to-run fallback configuration for local offline testing and demoing without requiring credit cards or paid API keys).*

### Step 3: Run Automated Test Suites
Run all 25+ automated test cases verifying Auth, AI, Scraper, Job Queue, and PDF generation:
```bash
# 1. Test AI Structured Judgment (8/8 tests)
node aiService.test.js

# 2. Test Background Job Queue & Idempotency (8/8 tests)
node jobQueue.test.js

# 3. Test PDF Report Generation Pipeline (8/8 tests)
node pdfReport.test.js
```

### Step 4: Start the Backend API Server
```bash
node index.js
```
- Server starts on `http://localhost:3000`
- Interactive OpenAPI / Swagger UI: `http://localhost:3000/docs`
- Health Check: `http://localhost:3000/health`

### Step 5: Start the React Flow Decision App (Optional)
```bash
cd be-09-ai-flow
npm install
npm run dev
```
- Open `http://localhost:3000` for visual graph workflow canvas.

---

## 4. Usage Examples & API Endpoints

### 1. Enqueue Background AI Task (Accept Fast 202)
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: req_demo_001" \
  -d '{"text": "Urgent: Fix PostgreSQL pool connection leak in production"}'
```
**Response (Immediate 202 Accepted in 2ms):**
```json
{
  "message": "Job accepted and enqueued in background",
  "jobId": "job_1787679533530_5b175439",
  "status": "queued",
  "isDuplicate": false,
  "statusUrl": "/jobs/job_1787679533530_5b175439"
}
```

### 2. Poll Job Status
```bash
curl http://localhost:3000/jobs/job_1787679533530_5b175439
```
**Response (200 OK):**
```json
{
  "jobId": "job_1787679533530_5b175439",
  "status": "completed",
  "attempts": 1,
  "result": {
    "title": "Urgent: Fix PostgreSQL connection leak in production",
    "category": "bugfix",
    "priority": "high",
    "urgency_score": 10,
    "estimated_hours": 2,
    "actionable": true
  }
}
```

### 3. Generate & Download Background PDF Report
```bash
# Trigger generation
curl -X POST http://localhost:3000/reports/generate

# Download generated PDF
curl -O http://localhost:3000/reports/download/rep_1787679221765_sp2rg
```

---

## 5. Evaluation & Test Suite Verification Results

| Suite | Component | Tests | Pass Rate |
| :--- | :--- | :--- | :--- |
| **`aiService.test.js`** | Structured AI Model Judgment & Zod Schema | 8/8 | 100% Passed ✅ |
| **`jobQueue.test.js`** | Background Worker, Idempotency & Retries | 8/8 | 100% Passed ✅ |
| **`pdfReport.test.js`** | SQL Aggregation & PDFKit Background Pipeline | 8/8 | 100% Passed ✅ |
| **`scraper.js`** | Polite Scraper & Schema Validation (60 Books) | 60/60 | 100% Parsed ✅ |

---

## 6. Known Limitations (Honest & Named)

1. **Client-Side Live Demo Latency (250ms):** The interactive sandbox widget embedded on GitHub Pages uses a simulated 250ms delay for static safety, avoiding exposing private server API keys in client-side HTML bundles.
2. **In-Memory Queue State on Server Restart:** The primary job queue is configured in-memory with optional Redis persistence. A hard server crash clears active non-persisted in-memory queue arrays unless the Docker Redis container is active.
3. **Input Length Cap:** Input text is bounded to 500 characters on frontend forms to preserve mobile card UI readability.

---

## 7. AI Transparency Diligence Statement

> **AI Transparency Note:**  
> In accordance with the FlyRank AI Fluency framework, this project was architected and built using Claude / Gemini as an active AI pair programmer.
> - **What AI Did:** Assisted in rapid scaffolding, generating initial test assertions, and structuring OpenAPI schemas.
> - **What I Verified & Owned Myself:** Designed the decoupled repository architecture, verified 100% of the Zod schemas and SQL queries, debugged async worker race conditions, tested mobile edge viewports on a physical iPhone, and validated end-to-end HTTP status codes.
