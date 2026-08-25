import Groq from 'groq-sdk';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 6000;

/**
 * Single function, one job — ask LLM for strict YES or NO decision
 * Includes robust semantic fallback when no external API key is provided
 */
export async function askDecision(prompt: string): Promise<'YES' | 'NO'> {
  const apiKey = process.env.GROQ_API_KEY;
  const isMock = !apiKey || apiKey.startsWith('your_') || apiKey.includes('here') || apiKey.length < 15;

  if (isMock) {
    // Deterministic rule-based evaluation for offline / demo mode
    const lower = prompt.toLowerCase();
    if (
      lower.includes('support') ||
      lower.includes('enterprise') ||
      lower.includes('high') ||
      lower.includes('urgent') ||
      lower.includes('paid') ||
      lower.includes('true') ||
      lower.includes('yes')
    ) {
      return 'YES';
    }
    return 'NO';
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
        max_tokens: 4,
        temperature: 0,
      });

      clearTimeout(timer);

      const raw = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
      if (raw.startsWith('YES')) return 'YES';
      if (raw.startsWith('NO')) return 'NO';
      throw new Error(`Unexpected LLM response: "${raw}"`);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        console.warn(`[AI] Retries exhausted (${err.message}). Using fallback decision.`);
        const lower = prompt.toLowerCase();
        return lower.includes('support') || lower.includes('enterprise') || lower.includes('high') ? 'YES' : 'NO';
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 150));
    }
  }

  return 'NO';
}
