/**
 * LLM provider abstraction with Gemini primary + OpenAI fallback.
 * Uses direct REST API calls (no SDK dependency).
 * Per-provider throttling for 15 min on 429 responses.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

interface LLMResult {
  text: string | null;
  status?: number;
  error?: unknown;
}

const throttleUntil: Record<string, number> = {};
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function isThrottled(modelKey: string): boolean {
  const until = throttleUntil[modelKey];
  return typeof until === "number" && until > Date.now();
}

function throttle(modelKey: string): void {
  throttleUntil[modelKey] = Date.now() + FIFTEEN_MIN_MS;
}

/**
 * Call Gemini API directly via REST
 */
async function callGemini(prompt: string, opts: LLMOptions): Promise<LLMResult> {
  if (!GEMINI_KEY) return { text: null };
  if (isThrottled("gemini")) return { text: null, status: 429 };

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 320,
          temperature: opts.temperature ?? 0.4,
          topP: opts.topP ?? 0.9,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throttle("gemini");
      return { text: null, status: response.status };
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("")
        ?.trim() ?? null;
    return { text };
  } catch (error) {
    return { text: null, error };
  }
}

/**
 * Call OpenAI API directly via REST
 */
async function callOpenAI(prompt: string, opts: LLMOptions): Promise<LLMResult> {
  if (!OPENAI_KEY) return { text: null };
  if (isThrottled("openai")) return { text: null, status: 429 };

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: opts.maxTokens ?? 320,
        temperature: opts.temperature ?? 0.4,
        top_p: opts.topP ?? 0.9,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throttle("openai");
      return { text: null, status: response.status };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? null;
    return { text };
  } catch (error) {
    return { text: null, error };
  }
}

/**
 * Try Gemini first, fall back to OpenAI. Both throttled on 429 for 15 min.
 * Addresses #4 (AI API rate limiting & costs) via per-provider throttling.
 */
export async function completeWithFallback(
  prompt: string,
  opts: LLMOptions = {}
): Promise<{ text: string | null; modelUsed: string | null }> {
  const candidates: { key: string; fn: (p: string, o: LLMOptions) => Promise<LLMResult> }[] = [
    { key: "gemini", fn: callGemini },
    { key: "openai", fn: callOpenAI },
  ].filter((c) => (c.key === "gemini" ? !!GEMINI_KEY : !!OPENAI_KEY));

  for (const candidate of candidates) {
    const result = await candidate.fn(prompt, opts);
    if (result.status === 429) continue;
    if (result.text) {
      return { text: result.text, modelUsed: candidate.key };
    }
  }

  return { text: null, modelUsed: null };
}
