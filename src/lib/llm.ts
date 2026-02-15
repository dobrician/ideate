/**
 * LLM provider abstraction with Gemini primary + OpenAI fallback.
 * Uses direct REST API calls (no SDK dependency).
 * Per-provider throttling for 15 min on 429 responses.
 * Token/request rate limiting and cost tracking (fixes #4).
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Max AI requests per hour (configurable via env) */
const MAX_REQUESTS_PER_HOUR = parseInt(
  process.env.AI_MAX_REQUESTS_PER_HOUR || "60",
  10
);

/** Max total tokens per hour (configurable via env) */
const MAX_TOKENS_PER_HOUR = parseInt(
  process.env.AI_MAX_TOKENS_PER_HOUR || "100000",
  10
);

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

interface LLMResult {
  text: string | null;
  status?: number;
  error?: unknown;
  tokensUsed?: number;
}

/** Cost per 1K tokens (approximate, in USD) */
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.000075, output: 0.0003 },
  openai: { input: 0.00015, output: 0.0006 },
};

interface UsageWindow {
  requests: number;
  tokens: number;
  costUsd: number;
  windowStart: number;
}

const HOUR_MS = 60 * 60 * 1000;
const throttleUntil: Record<string, number> = {};
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Sliding-window usage tracker (resets every hour) */
const usage: UsageWindow = {
  requests: 0,
  tokens: 0,
  costUsd: 0,
  windowStart: Date.now(),
};

function resetWindowIfStale(): void {
  if (Date.now() - usage.windowStart > HOUR_MS) {
    usage.requests = 0;
    usage.tokens = 0;
    usage.costUsd = 0;
    usage.windowStart = Date.now();
  }
}

function isRateLimited(): boolean {
  resetWindowIfStale();
  return (
    usage.requests >= MAX_REQUESTS_PER_HOUR ||
    usage.tokens >= MAX_TOKENS_PER_HOUR
  );
}

function trackUsage(provider: string, tokensUsed: number): void {
  resetWindowIfStale();
  usage.requests += 1;
  usage.tokens += tokensUsed;
  const rates = COST_PER_1K[provider];
  if (rates) {
    usage.costUsd += (tokensUsed / 1000) * rates.output;
  }
}

/**
 * Get current usage stats (for monitoring/dashboard)
 */
export function getAiUsageStats(): {
  requests: number;
  tokens: number;
  costUsd: number;
  maxRequests: number;
  maxTokens: number;
  windowStart: number;
} {
  resetWindowIfStale();
  return {
    requests: usage.requests,
    tokens: usage.tokens,
    costUsd: Math.round(usage.costUsd * 10000) / 10000,
    maxRequests: MAX_REQUESTS_PER_HOUR,
    maxTokens: MAX_TOKENS_PER_HOUR,
    windowStart: usage.windowStart,
  };
}

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
async function callGemini(
  prompt: string,
  opts: LLMOptions
): Promise<LLMResult> {
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
    const tokensUsed =
      data?.usageMetadata?.totalTokenCount ??
      data?.usageMetadata?.candidatesTokenCount ??
      (text ? Math.ceil(text.length / 4) : 0);
    return { text, tokensUsed };
  } catch (error) {
    return { text: null, error };
  }
}

/**
 * Call OpenAI API directly via REST
 */
async function callOpenAI(
  prompt: string,
  opts: LLMOptions
): Promise<LLMResult> {
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
    const tokensUsed =
      data?.usage?.total_tokens ??
      (text ? Math.ceil(text.length / 4) : 0);
    return { text, tokensUsed };
  } catch (error) {
    return { text: null, error };
  }
}

/**
 * Try Gemini first, fall back to OpenAI. Both throttled on 429 for 15 min.
 * Enforces per-hour rate limits on requests and tokens (fixes #4).
 */
export async function completeWithFallback(
  prompt: string,
  opts: LLMOptions = {}
): Promise<{ text: string | null; modelUsed: string | null }> {
  if (isRateLimited()) {
    return { text: null, modelUsed: null };
  }

  const candidates: {
    key: string;
    fn: (p: string, o: LLMOptions) => Promise<LLMResult>;
  }[] = [
    { key: "gemini", fn: callGemini },
    { key: "openai", fn: callOpenAI },
  ].filter((c) => (c.key === "gemini" ? !!GEMINI_KEY : !!OPENAI_KEY));

  for (const candidate of candidates) {
    const result = await candidate.fn(prompt, opts);
    if (result.status === 429) continue;
    if (result.text) {
      trackUsage(candidate.key, result.tokensUsed ?? 0);
      return { text: result.text, modelUsed: candidate.key };
    }
  }

  return { text: null, modelUsed: null };
}
