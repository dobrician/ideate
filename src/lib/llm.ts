/**
 * LLM provider abstraction (Anthropic only).
 * Uses direct REST API calls (no SDK dependency).
 * Throttling for 15 min on 429 responses.
 * Token/request rate limiting and cost tracking (fixes #4).
 * Structured pino logging for every LLM call (#46).
 */

import { logger } from "@/lib/logger";
import { getCachedResponse, setCachedResponse } from "@/lib/llm-cache";

const llmLog = logger.child({ module: "llm" });

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

/** Cost per 1K tokens (approximate, in USD) — Claude Haiku 4.5 */
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  anthropic: { input: 0.001, output: 0.005 },
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
  return !!ANTHROPIC_KEY;
}

/** Check if AI requests are currently rate-limited. */
export function isAiRateLimited(): boolean {
  return isRateLimited();
}

function trackUsage(provider: "anthropic", tokensUsed: number): void {
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
 * Call Anthropic Messages API directly via REST
 */
async function callAnthropic(
  prompt: string,
  opts: LLMOptions
): Promise<LLMResult> {
  if (isThrottled("anthropic")) {
    llmLog.warn({ provider: "anthropic", reason: "throttled" }, "LLM skipped (throttled)");
    return { text: null, status: 429, tokensUsed: 0 };
  }

  const start = Date.now();
  try {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY!,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens ?? 320,
        temperature: opts.temperature ?? 0.4,
        top_p: opts.topP ?? 0.9,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      if (response.status === 429) throttle("anthropic");
      llmLog.error({ provider: "anthropic", model: ANTHROPIC_MODEL, status: response.status, latencyMs }, "LLM request failed");
      return { text: null, status: response.status, tokensUsed: 0 };
    }

    const data = await response.json();
    const text =
      Array.isArray(data?.content)
        ? data.content
            .filter((b: { type?: string }) => b.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("")
            .trim() || null
        : null;
    const inputTokens = data?.usage?.input_tokens ?? 0;
    const outputTokens = data?.usage?.output_tokens ?? 0;
    const tokensUsed =
      inputTokens + outputTokens || (text ? Math.ceil(text.length / 4) : 0);
    llmLog.info({
      provider: "anthropic", model: ANTHROPIC_MODEL, latencyMs,
      promptLen: prompt.length, responseLen: text?.length ?? 0,
      tokensUsed, costUsd: (tokensUsed / 1000) * COST_PER_1K.anthropic.output,
    }, "LLM request completed");
    return { text, tokensUsed };
  } catch (error) {
    const latencyMs = Date.now() - start;
    llmLog.error({ provider: "anthropic", model: ANTHROPIC_MODEL, latencyMs, err: error }, "LLM request error");
    return { text: null, error, tokensUsed: 0 };
  }
}

/**
 * Call Anthropic. Throttled on 429 for 15 min.
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

  if (!ANTHROPIC_KEY) {
    llmLog.error({ provider: "anthropic" }, "LLM provider not configured");
    return { text: null, modelUsed: null };
  }

  const result = await callAnthropic(prompt, opts);
  if (result.text) {
    trackUsage("anthropic", result.tokensUsed);
    // Cache the successful response (fire-and-forget)
    setCachedResponse(prompt, result.text, "anthropic").catch(() => {});
    return { text: result.text, modelUsed: "anthropic" };
  }

  llmLog.error({ provider: "anthropic" }, "LLM request failed");
  return { text: null, modelUsed: null };
}
