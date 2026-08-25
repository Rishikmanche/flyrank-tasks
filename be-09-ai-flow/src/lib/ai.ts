import Groq from 'groq-sdk';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 8000;

// ponytail: single function, one job — ask LLM YES or NO
export async function askDecision(prompt: string): Promise<'YES' | 'NO'> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Deterministic fallback for demo/testing without API key
    return prompt.toLowerCase().includes('support') ? 'YES' : 'NO';
  }

  const groq = new Groq({ apiKey });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a strict binary decision system. Analyze the prompt and respond with EXACTLY one word: YES or NO. Nothing else.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 3,
        temperature: 0,
      });

      clearTimeout(timer);

      const raw = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
      if (raw.startsWith('YES')) return 'YES';
      if (raw.startsWith('NO')) return 'NO';
      // If LLM returned garbage, retry
      throw new Error(`Unexpected LLM response: "${raw}"`);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        console.error(`[AI] All ${MAX_RETRIES} retries failed:`, err.message);
        // ponytail: safe fallback instead of crashing
        return 'NO';
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
  return 'NO';
}
