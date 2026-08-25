const { z } = require('zod');
require('dotenv').config();

// Trusted Zod Schema for Structured LLM Judgment
const TaskClassificationSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  category: z.enum(['bugfix', 'feature', 'documentation', 'chore', 'other']),
  priority: z.enum(['high', 'medium', 'low']),
  urgency_score: z.number().int().min(1).max(10),
  estimated_hours: z.number().positive(),
  actionable: z.boolean(),
});

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

/**
 * Clean & normalize raw LLM output into trusted JSON
 */
function parseAndValidate(rawText) {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');

  const parsed = JSON.parse(cleaned);
  return TaskClassificationSchema.parse(parsed);
}

/**
 * Rule-based fallback classifier when LLM API times out or fails retries
 */
function generateFallback(text) {
  const lower = text.toLowerCase();
  let category = 'feature';
  let priority = 'medium';
  let urgency_score = 5;
  let estimated_hours = 2;

  if (lower.includes('bug') || lower.includes('fix') || lower.includes('error') || lower.includes('crash') || lower.includes('leak')) {
    category = 'bugfix';
    priority = 'high';
    urgency_score = 8;
  } else if (lower.includes('doc') || lower.includes('readme')) {
    category = 'documentation';
    priority = 'low';
    urgency_score = 3;
    estimated_hours = 1;
  } else if (lower.includes('refactor') || lower.includes('clean')) {
    category = 'chore';
    priority = 'low';
    urgency_score = 4;
  }

  if (lower.includes('urgent') || lower.includes('immediately') || lower.includes('asap')) {
    priority = 'high';
    urgency_score = 10;
  }

  const title = text.length > 50 ? text.substring(0, 47) + '...' : text;

  return {
    title,
    category,
    priority,
    urgency_score,
    estimated_hours,
    actionable: true,
  };
}

/**
 * Primary AI Classification Function with Retries, Timeouts & Validation
 */
async function classifyTask(text, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('Input text is required');
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!apiKey || apiKey.startsWith('demo') || options.forceMock) {
        // Deterministic mock LLM simulation for testing / offline execution
        clearTimeout(timer);
        return generateFallback(text);
      }

      // External LLM API Call (OpenAI / Groq Compatible Endpoint)
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a strict backend task classification system. Analyze the task text and output ONLY valid JSON matching this schema:
{
  "title": "Concise summary title string",
  "category": "bugfix" | "feature" | "documentation" | "chore" | "other",
  "priority": "high" | "medium" | "low",
  "urgency_score": integer 1-10,
  "estimated_hours": positive number,
  "actionable": boolean
}`,
            },
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Transient API error HTTP ${response.status}`);
        } else {
          throw new Error(`Permanent API error HTTP ${response.status}`);
        }
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      return parseAndValidate(content);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`[AIService] Attempt ${attempt} timed out after ${timeoutMs}ms`);
      } else {
        console.warn(`[AIService] Attempt ${attempt} failed: ${err.message}`);
      }

      // Exponential backoff delay before retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }

  // Graceful Fallback after retries exhausted
  console.warn(`[AIService] Exhausted ${MAX_RETRIES} retries. Using reliable fallback classifier.`);
  return generateFallback(text);
}

module.exports = {
  TaskClassificationSchema,
  parseAndValidate,
  generateFallback,
  classifyTask,
};
