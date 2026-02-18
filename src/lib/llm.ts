/**
 * LLM provider abstraction with Gemini primary + OpenAI fallback.
 * Uses direct REST API calls (no SDK dependency).
 * Per-provider throttling for 15 min on 429 responses.
 * Token/request rate limiting and cost tracking (fixes #4).
 * Structured pino logging for every LLM call (#46).
 */

import { logger } from "@/lib/logger";
import { getCachedResponse, setCachedResponse } from "@/lib/llm-cache";

const llmLog = logger.child({ module: "llm" });

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
  tokensUsed: number;
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

/** Check if any AI API key is configured. */
export function isAiConfigured(): boolean {
  return !!(GEMINI_KEY || OPENAI_KEY);
}

/** Check if AI requests are currently rate-limited. */
export function isAiRateLimited(): boolean {
  return isRateLimited();
}

function trackUsage(provider: "gemini" | "openai", tokensUsed: number): void {
  resetWindowIfStale();
  usage.requests += 1;
  usage.tokens += tokensUsed;
  usage.costUsd += (tokensUsed / 1000) * COST_PER_1K[provider].output;
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
  if (isThrottled("gemini")) {
    llmLog.warn({ provider: "gemini", reason: "throttled" }, "LLM skipped (throttled)");
    return { text: null, status: 429, tokensUsed: 0 };
  }

  const start = Date.now();
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 320,
          temperature: opts.temperature ?? 0.4,
          topP: opts.topP ?? 0.9,
        },
      }),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      if (response.status === 429) throttle("gemini");
      llmLog.error({ provider: "gemini", model: GEMINI_MODEL, status: response.status, latencyMs }, "LLM request failed");
      return { text: null, status: response.status, tokensUsed: 0 };
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
    llmLog.info({
      provider: "gemini", model: GEMINI_MODEL, latencyMs,
      promptLen: prompt.length, responseLen: text?.length ?? 0,
      tokensUsed, costUsd: (tokensUsed / 1000) * COST_PER_1K.gemini.output,
    }, "LLM request completed");
    return { text, tokensUsed };
  } catch (error) {
    const latencyMs = Date.now() - start;
    llmLog.error({ provider: "gemini", model: GEMINI_MODEL, latencyMs, err: error }, "LLM request error");
    return { text: null, error, tokensUsed: 0 };
  }
}

/**
 * Call OpenAI API directly via REST
 */
async function callOpenAI(
  prompt: string,
  opts: LLMOptions
): Promise<LLMResult> {
  if (isThrottled("openai")) {
    llmLog.warn({ provider: "openai", reason: "throttled" }, "LLM skipped (throttled)");
    return { text: null, status: 429, tokensUsed: 0 };
  }

  const start = Date.now();
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

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      if (response.status === 429) throttle("openai");
      llmLog.error({ provider: "openai", model: OPENAI_MODEL, status: response.status, latencyMs }, "LLM request failed");
      return { text: null, status: response.status, tokensUsed: 0 };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? null;
    const tokensUsed =
      data?.usage?.total_tokens ??
      (text ? Math.ceil(text.length / 4) : 0);
    llmLog.info({
      provider: "openai", model: OPENAI_MODEL, latencyMs,
      promptLen: prompt.length, responseLen: text?.length ?? 0,
      tokensUsed, costUsd: (tokensUsed / 1000) * COST_PER_1K.openai.output,
    }, "LLM request completed");
    return { text, tokensUsed };
  } catch (error) {
    const latencyMs = Date.now() - start;
    llmLog.error({ provider: "openai", model: OPENAI_MODEL, latencyMs, err: error }, "LLM request error");
    return { text: null, error, tokensUsed: 0 };
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
  // Check cache first
  try {
    const cached = await getCachedResponse(prompt);
    if (cached) {
      return { text: cached.response, modelUsed: cached.modelUsed };
    }
  } catch {
    // Cache check failed — proceed without cache
  }

  if (isRateLimited()) {
    llmLog.warn({ requests: usage.requests, tokens: usage.tokens }, "LLM rate limited");
    return { text: null, modelUsed: null };
  }

  const candidates = ([
    { key: "gemini" as const, fn: callGemini },
    { key: "openai" as const, fn: callOpenAI },
  ] as const).filter((c) => (c.key === "gemini" ? !!GEMINI_KEY : !!OPENAI_KEY));

  for (const candidate of candidates) {
    const result = await candidate.fn(prompt, opts);
    if (result.status === 429) continue;
    if (result.text) {
      trackUsage(candidate.key, result.tokensUsed);
      // Cache the successful response (fire-and-forget)
      setCachedResponse(prompt, result.text, candidate.key).catch(() => {});
      return { text: result.text, modelUsed: candidate.key };
    }
    if (candidate.key !== candidates[candidates.length - 1]?.key) {
      llmLog.warn({ failed: candidate.key }, "LLM primary failed, falling back");
    }
  }

  llmLog.error({ providers: candidates.map((c) => c.key) }, "All LLM providers failed");
  return { text: null, modelUsed: null };
}
