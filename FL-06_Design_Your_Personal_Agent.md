# FL-06: Personal Agent Design Specification

**Agent Name:** Backend API Debugger & Self-Healing Patch Agent ("PatchBot")  
**Track:** General AI Fluency  
**Phase:** Build (core) (Week 5) | **Workload:** 4h  
**Author:** Rishik Manche (`rishikmanche@gmail.com`) — Software Engineering Intern, FlyRank AI  
**Repository:** [flyrank-tasks](https://github.com/Rishikmanche/flyrank-tasks)  
**Estimated Build Scope:** ~10 Build Hours

---

## 1. Job to be Done & User Persona

### Job to be Done
When building microservices (Express.js, PostgreSQL, Docker), debugging failing unit tests, unhandled HTTP runtime errors, or database schema mismatches consumes significant developer velocity. 

**PatchBot** is a specialized personal AI engineering agent that:
1. Listens for failing test runs or error stack traces.
2. Dynamically investigates local codebase files, SQL schemas, and container logs using MCP tools.
3. Formulates a targeted code fix on an isolated git branch (`fix/...`).
4. Executes test suites (`npm test`) to verify the fix.
5. Generates a pull request with a technical root-cause explanation for human review.

```mermaid
graph TD
    UserReq["1. User / CI Error Trigger<br>• Failing Test / Error Log"] --> AgentLoop["2. ReAct Autonomous Agent Loop<br>• Reason & Plan Next Tool Call"]
    AgentLoop --> Tools["3. MCP Tool Execution<br>• mcp_filesystem (Read/Edit)<br>• mcp_postgres (Schema Check)<br>• mcp_system (run_command 'npm test')"]
    Tools --> Verification{"4. Test Suite Pass?"}
    Verification -->|Tests Fail| AgentLoop
    Verification -->|Tests Pass| Guardrail["5. Human Guardrail Check<br>• Request Confirmation for PR Submission"]
    Guardrail --> Output["6. Pull Request Created<br>• Branch: fix/issue-id<br>• Includes Root Cause & Test Proof"]
```

### User Persona & Usage Frequency
- **Target User:** Rishik Manche (Backend Software Engineering Intern).
- **Usage Frequency:** Executed 3–5 times daily during active development sprints and CI test failures.

---

## 2. Tools & Data Sources with Access Plan

| Tool Name | Tool Type | Server Provider | Access & Authentication Plan | Agent Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`mcp_filesystem`** | File System Tool | Local MCP Server | Local filesystem read/write access to `/flyrank` repo. | Read controller code, edit bug fixes, inspect logs. |
| **`mcp_git`** | Version Control Tool | Git MCP Plugin | GitHub Personal Access Token (`GH_PAT`) & local `git` CLI. | Create `fix/...` branches, commit changes, open PRs. |
| **`mcp_postgres`** | Database Tool | `supabase-mcp-server` | Local Postgres URI `postgres://postgres:postgres@localhost:5432/tasksdb`. | Inspect schema (`information_schema`), verify SQL indexes. |
| **`mcp_system`** | Shell Runner Tool | Local MCP Server | Restricted sub-process execution (`npm test`, `docker compose ps`). | Execute test runners and container status checks. |

---

## 3. Draft Instructions & ReAct System Prompt

```text
SYSTEM PROMPT:
You are PatchBot, an autonomous Backend Engineering Debugger and Self-Healing Patch Agent.

CORE RESPONSIBILITY:
Your job is to investigate backend runtime errors, database schema mismatches, and failing unit tests, formulate minimal code fixes, verify them via local test commands, and prepare Pull Requests for human review.

REACT REASONING LOOP:
For every step, output your thought process enclosed in XML tags:
<thinking>
1. Evaluate the current error trace or test output.
2. Identify what information is missing.
3. Select the next MCP tool to execute.
</thinking>

<action>
Call the selected MCP tool with exact parameters.
</action>

<observation>
Analyze the output returned by the MCP tool.
</observation>

STRICT CONSTRAINTS & GUARDRAILS:
1. NEVER commit or push directly to the `main` branch. Always checkout an isolated `fix/bug-description` branch.
2. NEVER execute destructive database queries (`DROP TABLE`, `TRUNCATE`) or destructive shell commands (`rm -rf`).
3. ALWAYS verify your fix by running `npm test` before requesting human confirmation.
4. STOP and ask for explicit human confirmation before pushing a git branch or creating a Pull Request.
```

---

## 4. Five Pre-Build Evaluation Scenarios (Eval Suite)

Before building PatchBot, we define 5 concrete evaluation scenarios to test the agent's reasoning, tool selection, and fix accuracy:

| Eval Case # | Scenario / Error Input | Expected Agent Tool Sequence | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Eval 1** | **Syntax Error in Controller:** `TypeError: Cannot read properties of undefined (reading 'trim')` on `POST /tasks`. | `mcp_filesystem_read_file` -> `mcp_filesystem_write_file` -> `run_command("npm test")`. | Agent adds optional chaining (`req.body?.title?.trim()`), test suite passes 100%. |
| **Eval 2** | **DB Schema Mismatch:** `relation "tasks" does not exist` during server startup. | `mcp_postgres_execute_sql` -> `mcp_filesystem_read_file("init.sql")` -> `run_command("node index.js")`. | Agent detects missing table initialization, executes `initDb()`, verifies connection. |
| **Eval 3** | **Auth Token Rejection:** `401 Unauthorized` on `GET /protected/profile` despite passing `Authorization` header. | `mcp_filesystem_read_file("index.js")` -> `mcp_filesystem_read_file("authService.js")`. | Agent identifies missing `Bearer ` prefix stripping logic in `requireAuth` middleware and fixes parser. |
| **Eval 4** | **Redis Healthcheck Fallback:** `ioredis ECONNREFUSED` throwing unhandled error when Redis container is stopped. | `mcp_filesystem_read_file("taskRepository.js")` -> `mcp_filesystem_write_file`. | Agent attaches silent `.on('error', () => {})` listener for graceful fallback. |
| **Eval 5** | **Docker Port Collision:** Express server fails to start due to `EADDRINUSE: 3000`. | `run_command("docker compose ps")` -> `mcp_filesystem_read_file(".env")`. | Agent identifies port collision, updates `.env` to fallback port `3001`, and restarts server. |

---

## 5. Risks, Safety Rules & Human-in-the-Loop Guardrails

Following OpenAI's *A Practical Guide to Building Agents*, we implement strict guardrail boundaries for high-risk or irreversible actions:

```mermaid
graph TD
    AgentAction[Agent Formulates Code Patch & Verifies Tests] --> GuardrailCheck{"Is Action Destructive or Irreversible?"}
    GuardrailCheck -->|Read-Only: Inspect Files, Run Tests| AutoExec[Execute Automatically via MCP]
    GuardrailCheck -->|High-Risk: Git Push, PR Creation, Schema Alteration| HumanReview["🛑 STOP & REQUEST HUMAN APPROVAL<br>Display proposed diff + test logs<br>Require 'Yes / Approve' response"]
    HumanReview -->|User Approves| ExecPR[Submit Pull Request]
    HumanReview -->|User Rejects| Rollback[Roll Back Branch & Retry]
```

- **Rule 1 (Branch Isolation):** Agent is hard-blocked from executing `git push origin main`. All patches must occur on `fix/*`.
- **Rule 2 (No Destructive Commands):** MCP server config blocks `rm -rf`, `sudo`, `DROP TABLE`, `DELETE FROM` without explicit `WHERE` clauses.
- **Rule 3 (Human Confirmation Gate):** Before executing a git push or opening a PR, the agent MUST output the complete code diff and test verification logs, stopping until the human user enters `proceed`.

---

## 6. Platform Choice & Justification

### Chosen Platform: **Claude Desktop / Antigravity Agent Runtime with Local MCP Servers**

### Platform Comparison & Rationale

| Platform Option | Local File & DB Tool Access | Custom ReAct Reasoning Loop | Free / Low-Cost Tier | Verdict & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Claude Desktop + MCP** *(CHOSEN)* | **Native (Full Local MCP support)** | **Native (Claude 3.5 Sonnet)** | **Free Tier / Local Client** | **WINNER:** Direct access to local codebase, Postgres, and shell runner via standardized MCP protocol. |
| **Custom GPT (OpenAI)** | Limited (No direct local terminal/DB access) | Native | Requires Paid ChatGPT Plus ($20/mo) | **REJECTED:** Restricted to sandboxed Python environment; cannot execute local Docker or git commands. |
| **n8n Workflow Agent** | Via webhooks/API nodes | Fixed visual nodes | Free Self-Hosted | **REJECTED:** Excellent for fixed workflows, but lacks dynamic ReAct code-patching reasoning loops. |

---

## 7. Evaluation Checklist Self-Audit (Pass / Revise)

- [x] **Achievable Scope (~10 Build Hours)**: Focuses tightly on automated bug investigation, local code editing, test verification, and PR creation.
- [x] **Realistic Tool Access Plan**: All 4 tools mapped to existing local MCP servers (`mcp_filesystem`, `mcp_git`, `mcp_postgres`, `mcp_system`).
- [x] **Five Pre-Build Eval Cases**: Defined 5 specific error scenarios (syntax, DB schema, auth token, Redis fallback, port collision).
- [x] **Guardrails Specified**: Implemented hard human-in-the-loop gates for git pushes, PR submissions, and destructive commands.
- [x] **Platform Choice Justified**: Evaluated Claude Desktop + MCP against Custom GPTs and n8n.
