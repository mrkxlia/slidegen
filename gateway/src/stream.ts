// stream.ts — LLM 応答のストリーミング（SSE）を共通形式へ正規化する。
//
// プロバイダごとに SSE/チャンク形式が違うため、ここで吸収し、
// 呼び出し側へは「テキスト delta の AsyncGenerator」として渡す。
// index.ts はこれを `data: {"delta": "..."}` の自前 SSE にして返す。
import { buildGeminiPayload, LLMError, type ChatRequest, type ProviderEnv } from "./providers";

// 上流 LLM への 1 リクエストあたりのストールガード。接続後に無音で固まる上流に対し、
// body reader の read() を abort で reject させ、index.ts の catch で次候補へフォールバックさせる。
// whole-request タイムアウトなので、これを超える長考は途中で切られる（短い壁打ち/DSL では問題にならない）。
const UPSTREAM_TIMEOUT_MS = 60_000;

// fetch レスポンス body(SSE) を行単位でパースし、`data:` の JSON を yield する。
async function* sseJson(resp: Response): AsyncGenerator<unknown> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // Gemini の alt=sse は CRLF(\r\n\r\n)区切り。\r を除去して \n\n に正規化する
    // （これが無いとイベントを1件も切り出せず、delta ゼロで done になる）。
    buf += decoder.decode(value, { stream: true }).replace(/\r/g, "");
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

// OpenAI互換/Workers AI 共通のメッセージ配列を組み立てる（system を先頭に畳む）。
// vision のとき images を data-URI の image_url パートに展開する（非 vision は string content のまま剥がす）。
function buildOpenAIMessages(req: ChatRequest) {
  const msgs = req.messages.map((m) => {
    const images = (req.vision && m.images) || [];
    if (!images.length) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content },
        ...images.map((im) => ({
          type: "image_url",
          image_url: { url: `data:${im.mimeType};base64,${im.data}` },
        })),
      ],
    };
  });
  return [...(req.system ? [{ role: "system", content: req.system }] : []), ...msgs];
}

async function httpError(resp: Response, who: string): Promise<LLMError> {
  const body = await resp.text().catch(() => "");
  const retryable = resp.status === 429 || resp.status >= 500;
  // 上流の生エラー本文はサーバログにのみ残し、クライアントには種別+ステータスだけ返す
  // （上流のエラー詳細が利用者に露出するのを防ぐ）。
  console.error(`[${who}] upstream ${resp.status}: ${body.slice(0, 500)}`);
  return new LLMError(`${who} upstream error (${resp.status})`, resp.status, retryable);
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
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!resp.ok) throw await httpError(resp, "gemini");
  for await (const ev of sseJson(resp)) {
    const parts = (ev as any)?.candidates?.[0]?.content?.parts ?? [];
    // thought パート(思考の要約)は本文に出さない。
    for (const p of parts) if (p.text && !p.thought) yield p.text as string;
  }
}

async function* streamOpenAICompatible(
  url: string, apiKey: string | undefined, req: ChatRequest,
  maxTokens: number, temperature: number, extraHeaders: Record<string, string> = {},
) {
  if (!apiKey) throw new LLMError("API key not set", 401);
  const messages = buildOpenAIMessages(req);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model: req.model, messages, max_tokens: maxTokens, temperature, stream: true }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!resp.ok) throw await httpError(resp, "openai-compatible");
  for await (const ev of sseJson(resp)) {
    const delta = (ev as any)?.choices?.[0]?.delta?.content;
    if (delta) yield delta as string;
  }
}

async function* streamAnthropic(req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number) {
  if (!env.ANTHROPIC_API_KEY) throw new LLMError("ANTHROPIC_API_KEY not set", 401);
  // vision のとき images を content blocks に展開（非 vision は string content のまま剥がす）。
  const messages = req.messages.map((m) => {
    const images = (req.vision && m.images) || [];
    if (!images.length) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: [
        ...images.map((im) => ({
          type: "image",
          source: { type: "base64", media_type: im.mimeType, data: im.data },
        })),
        { type: "text", text: m.content },
      ],
    };
  });
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: req.model, system: req.system || undefined, max_tokens: maxTokens, temperature, messages, stream: true }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!resp.ok) throw await httpError(resp, "anthropic");
  for await (const ev of sseJson(resp)) {
    const e = ev as any;
    if (e?.type === "content_block_delta" && e?.delta?.text) yield e.delta.text as string;
  }
}

async function* streamWorkersAI(req: ChatRequest, env: ProviderEnv, maxTokens: number) {
  const messages = buildOpenAIMessages(req);
  if (env.AI) {
    // バインディング経路は AbortSignal 非対応のため上流タイムアウトは付かない（CF プラットフォーム側の制限に委ねる）。
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
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
