// stream.ts — LLM 応答のストリーミング（SSE）を共通形式へ正規化する。
//
// プロバイダごとに SSE/チャンク形式が違うため、ここで吸収し、
// 呼び出し側へは「テキスト delta の AsyncGenerator」として渡す。
// index.ts はこれを `data: {"delta": "..."}` の自前 SSE にして返す。
import { buildGeminiPayload, LLMError, type ChatRequest, type ProviderEnv } from "./providers";

// fetch レスポンス body(SSE) を行単位でパースし、`data:` の JSON を yield する。
async function* sseJson(resp: Response): AsyncGenerator<unknown> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE イベントは空行(\n\n)区切り。各イベントの data: を連結。
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const evt = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLines = evt.split("\n").filter((l) => l.startsWith("data:"));
      if (!dataLines.length) continue;
      const data = dataLines.map((l) => l.slice(5).trim()).join("");
      if (data === "[DONE]") return;
      try { yield JSON.parse(data); } catch { /* skip keep-alive/partial */ }
    }
  }
}

async function httpError(resp: Response, who: string): Promise<LLMError> {
  const body = await resp.text().catch(() => "");
  const retryable = resp.status === 429 || resp.status >= 500;
  return new LLMError(`${who} ${resp.status}: ${body.slice(0, 300)}`, resp.status, retryable);
}

// provider ごとのテキスト delta ストリーム。
export async function* streamDeltas(
  req: ChatRequest, env: ProviderEnv,
  maxTokens = 4096, temperature = 0.4,
): AsyncGenerator<string> {
  switch (req.provider) {
    case "gemini": yield* streamGemini(req, env, maxTokens, temperature); return;
    case "openrouter":
      yield* streamOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY,
        req, maxTokens, temperature,
        { "HTTP-Referer": "https://slidegen.app", "X-Title": "slidegen" });
      return;
    case "openai":
      yield* streamOpenAICompatible(
        "https://api.openai.com/v1/chat/completions", env.OPENAI_API_KEY,
        req, maxTokens, temperature);
      return;
    case "anthropic": yield* streamAnthropic(req, env, maxTokens, temperature); return;
    case "workers_ai": yield* streamWorkersAI(req, env, maxTokens); return;
    default: throw new LLMError(`unsupported provider: ${req.provider}`, 400);
  }
}

async function* streamGemini(req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number) {
  if (!env.GEMINI_API_KEY) throw new LLMError("GEMINI_API_KEY not set", 401);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`;
  const body = buildGeminiPayload(req, maxTokens, temperature);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp, "gemini");
  for await (const ev of sseJson(resp)) {
    const parts = (ev as any)?.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) if (p.text) yield p.text as string;
  }
}

async function* streamOpenAICompatible(
  url: string, apiKey: string | undefined, req: ChatRequest,
  maxTokens: number, temperature: number, extraHeaders: Record<string, string> = {},
) {
  if (!apiKey) throw new LLMError("API key not set", 401);
  const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages];
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model: req.model, messages, max_tokens: maxTokens, temperature, stream: true }),
  });
  if (!resp.ok) throw await httpError(resp, "openai-compatible");
  for await (const ev of sseJson(resp)) {
    const delta = (ev as any)?.choices?.[0]?.delta?.content;
    if (delta) yield delta as string;
  }
}

async function* streamAnthropic(req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number) {
  if (!env.ANTHROPIC_API_KEY) throw new LLMError("ANTHROPIC_API_KEY not set", 401);
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: req.model, system: req.system || undefined, max_tokens: maxTokens, temperature, messages: req.messages, stream: true }),
  });
  if (!resp.ok) throw await httpError(resp, "anthropic");
  for await (const ev of sseJson(resp)) {
    const e = ev as any;
    if (e?.type === "content_block_delta" && e?.delta?.text) yield e.delta.text as string;
  }
}

async function* streamWorkersAI(req: ChatRequest, env: ProviderEnv, maxTokens: number) {
  const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages];
  if (env.AI) {
    const out = (await env.AI.run(req.model, { messages, max_tokens: maxTokens, stream: true })) as ReadableStream;
    const resp = new Response(out);
    for await (const ev of sseJson(resp)) {
      const r = (ev as any)?.response;
      if (r) yield r as string;
    }
    return;
  }
  if (env.CF_ACCOUNT_ID && env.CF_AI_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${req.model}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CF_AI_API_TOKEN}` },
      body: JSON.stringify({ messages, max_tokens: maxTokens, stream: true }),
    });
    if (!resp.ok) throw await httpError(resp, "workers_ai");
    for await (const ev of sseJson(resp)) {
      const r = (ev as any)?.response;
      if (r) yield r as string;
    }
    return;
  }
  throw new LLMError("Workers AI unavailable (no binding / no REST creds)", 501);
}
