# BE-09: AI Decision Flow with React Flow + Inngest

A visual AI workflow system where each node represents an AI decision step that returns **YES** or **NO**. Workflow execution runs through Inngest while the frontend visualizes the flow using React Flow.

## Quick Start

```bash
cd be-09-ai-flow
npm install
npm run dev         # → http://localhost:3000
```

Optional (for Inngest dashboard):
```bash
npx inngest-cli@latest dev
```

## Architecture

```
POST /api/execute    →  Traverses graph, calls LLM at each node
POST /api/inngest    →  Inngest serve endpoint (step-based execution)
```

Each node sends its prompt to Groq (Llama 3.3 70B) and receives a strict YES/NO. The workflow follows the matching edge to the next node.

## Tech Stack

- **Next.js 14** (App Router)
- **React Flow** (@xyflow/react) — visual flow editor
- **Inngest** — durable workflow execution
- **Groq SDK** — free LLM inference (Llama 3.3 70B)
- **Zustand** — client-side state management
- **Tailwind CSS** — styling

## Environment Variables

```
GROQ_API_KEY=your_groq_api_key    # Optional: falls back to rule-based demo
```

## Features

- ✅ Visual flow editor with drag-and-drop nodes
- ✅ Editable prompts (click to edit inline)
- ✅ YES (green) / NO (red) edge connections
- ✅ End-to-end AI-powered workflow execution
- ✅ Visual execution state (nodes glow green/red)
- ✅ Execution logs panel (step-by-step sidebar)
- ✅ JSON export/import workflows
- ✅ Error handling with retry + fallback
- ✅ localStorage persistence (Save/Load)
