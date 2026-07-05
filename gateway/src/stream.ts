// stream.ts — LLM 応答のストリーミング（SSE）を共通形式へ正規化する。
//
// プロバイダごとに SSE/チャンク形式が違うため、ここで吸収し、
// 呼び出し側へは「テキスト delta の AsyncGenerator」として渡す。
// index.ts はこれを `data: {"delta": "..."}` の自前 SSE にして返す。
import { buildGeminiPayload, imagesFor, LLMError, type ChatRequest, type ProviderEnv } from "./providers";

// 上流 LLM への 1 リクエストあたりのストールガード。接続後に無音で固まる上流に対し、
// body reader の read() を abort で reject させ、index.ts の catch で次候補へフォールバックさせる。
// whole-request タイムアウトなので、これを超える長考は途中で切られる（短い壁打ち/DSL では問題にならない）。
const UPSTREAM_TIMEOUT_MS = 60_000;

// SSE の1イベント分から `data:` 行を取り出し JSON パースする。呼び出し側で yield/return を判断する。
function parseSseEvent(evt: string): { done: true } | { data: unknown } | undefined {
  const dataLines = evt.split("\n").filter((l) => l.startsWith("data:"));
  if (!dataLines.length) return undefined;
  const data = dataLines.map((l) => l.slice(5).trim()).join("\n");
  if (data === "[DONE]") return { done: true };
  try { return { data: JSON.parse(data) }; } catch { return undefined; /* skip keep-alive/partial */ }
}

// fetch レスポンス body(SSE) を行単位でパースし、`data:` の JSON を yield する。
async function* sseJson(resp: Response): AsyncGenerator<unknown> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
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
        const parsed = parseSseEvent(evt);
        if (!parsed) continue;
        if ("done" in parsed) return;
        yield parsed.data;
      }
    }
    // ストリーム終端後、末尾の \n\n を欠いたまま残った最終イベントをフラッシュする
    // （終端 flush・上流が行末で切れて閉じたケースを取りこぼさない）。
    buf += decoder.decode();
    const parsed = parseSseEvent(buf);
    if (parsed && !("done" in parsed)) yield parsed.data;
  } finally {
    // [DONE] 早期 return・呼び出し元の break/throw いずれでも upstream reader を解放する。
    await reader.cancel().catch(() => {});
  }
}

// OpenAI互換/Workers AI 共通のメッセージ配列を組み立てる（system を先頭に畳む）。
// vision のとき images を data-URI の image_url パートに展開する（非 vision は string content のまま剥がす）。
function buildOpenAIMessages(req: ChatRequest) {
  const msgs = req.messages.map((m) => {
    const images = imagesFor(req, m);
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

// ストールガード(UPSTREAM_TIMEOUT_MS)と呼び出し側の中断(clientSignal、例: ブラウザ切断)を
// 両方効かせる合成シグナルを作る。
function upstreamSignal(clientSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  return clientSignal ? AbortSignal.any([timeout, clientSignal]) : timeout;
}

// provider ごとのテキスト delta ストリーム。
// clientSignal: 呼び出し側（index.ts の ReadableStream.cancel）が中断したら上流 fetch も打ち切る。
export async function* streamDeltas(
  req: ChatRequest, env: ProviderEnv,
  maxTokens = 4096, temperature = 0.4, clientSignal?: AbortSignal,
): AsyncGenerator<string> {
  switch (req.provider) {
    case "gemini": yield* streamGemini(req, env, maxTokens, temperature, clientSignal); return;
    case "openrouter":
      yield* streamOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY,
        req, maxTokens, temperature,
        { "HTTP-Referer": "https://slidegen.app", "X-Title": "slidegen" }, clientSignal);
      return;
    case "openai":
      yield* streamOpenAICompatible(
        "https://api.openai.com/v1/chat/completions", env.OPENAI_API_KEY,
        req, maxTokens, temperature, {}, clientSignal);
      return;
    case "anthropic": yield* streamAnthropic(req, env, maxTokens, temperature, clientSignal); return;
    case "workers_ai": yield* streamWorkersAI(req, env, maxTokens, clientSignal); return;
    default: throw new LLMError(`unsupported provider: ${req.provider}`, 400);
  }
}

async function* streamGemini(
  req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number, clientSignal?: AbortSignal,
) {
  if (!env.GEMINI_API_KEY) throw new LLMError("GEMINI_API_KEY not set", 401);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`;
  const body = buildGeminiPayload(req, maxTokens, temperature);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: upstreamSignal(clientSignal),
  });
  if (!resp.ok) throw await httpError(resp, "gemini");
  for await (const ev of sseJson(resp)) {
    const e = ev as any;
    // 200 で開始しても、ストリーム途中に in-band でエラーオブジェクトが来ることがある
    // （安全フィルタ・上流障害等）。無視すると「途中まで出力→無言で正常終了」に化けるため throw する。
    if (e?.error) {
      // 上流の生エラー本文はサーバログにのみ残し、クライアントには種別だけ返す（httpError と同方針）。
      console.error(`[gemini] in-band stream error: ${JSON.stringify(e.error).slice(0, 500)}`);
      throw new LLMError("gemini stream error", 502, true);
    }
    const parts = e?.candidates?.[0]?.content?.parts ?? [];
    // thought パート(思考の要約)は本文に出さない。
    for (const p of parts) if (p.text && !p.thought) yield p.text as string;
  }
}

async function* streamOpenAICompatible(
  url: string, apiKey: string | undefined, req: ChatRequest,
  maxTokens: number, temperature: number, extraHeaders: Record<string, string> = {}, clientSignal?: AbortSignal,
) {
  if (!apiKey) throw new LLMError("API key not set", 401);
  const messages = buildOpenAIMessages(req);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model: req.model, messages, max_tokens: maxTokens, temperature, stream: true }),
    signal: upstreamSignal(clientSignal),
  });
  if (!resp.ok) throw await httpError(resp, "openai-compatible");
  for await (const ev of sseJson(resp)) {
    const e = ev as any;
    // OpenRouter 等は 200 で開始後もストリーム途中に `{"error":{...}}` を送ることがある。
    // 無視すると「途中まで出力→無言で正常終了」に化けるため throw する。
    if (e?.error) {
      console.error(`[openai-compatible] in-band stream error: ${JSON.stringify(e.error).slice(0, 500)}`);
      throw new LLMError("openai-compatible stream error", 502, true);
    }
    const delta = e?.choices?.[0]?.delta?.content;
    if (delta) yield delta as string;
  }
}

async function* streamAnthropic(
  req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number, clientSignal?: AbortSignal,
) {
  if (!env.ANTHROPIC_API_KEY) throw new LLMError("ANTHROPIC_API_KEY not set", 401);
  // vision のとき images を content blocks に展開（非 vision は string content のまま剥がす）。
  const messages = req.messages.map((m) => {
    const images = imagesFor(req, m);
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
    signal: upstreamSignal(clientSignal),
  });
  if (!resp.ok) throw await httpError(resp, "anthropic");
  for await (const ev of sseJson(resp)) {
    const e = ev as any;
    // Anthropic は 200 で開始後もストリーム途中に `{"type":"error", "error":{...}}`
    // （overloaded_error 等）を送ることがある。無視すると「途中まで出力→無言で正常終了」に化ける。
    if (e?.type === "error") {
      console.error(`[anthropic] in-band stream error: ${JSON.stringify(e.error).slice(0, 500)}`);
      throw new LLMError("anthropic stream error", 502, true);
    }
    if (e?.type === "content_block_delta" && e?.delta?.text) yield e.delta.text as string;
  }
}

// Workers AI の SSE レスポンスは binding/REST どちらの経路でも `{"response":"..."}` 形式。
async function* yieldWorkersAIText(resp: Response): AsyncGenerator<string> {
  for await (const ev of sseJson(resp)) {
    const r = (ev as any)?.response;
    if (r) yield r as string;
  }
}

// binding 呼び出し(env.AI.run)は AbortSignal を受け付けないため、上流 fetch 自体は中断できない。
// ここでは「呼び出し元がいつまでも待たされる」ことだけを防ぐソフトタイムアウトを掛ける
// （タイムアウト後も binding 呼び出し自体はバックグラウンドで継続しうる点に注意）。
function withSoftTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LLMError(message, 504, true)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function* streamWorkersAI(req: ChatRequest, env: ProviderEnv, maxTokens: number, clientSignal?: AbortSignal) {
  const messages = buildOpenAIMessages(req);
  if (env.AI) {
    const out = await withSoftTimeout(
      env.AI.run(req.model, { messages, max_tokens: maxTokens, stream: true }) as Promise<ReadableStream>,
      UPSTREAM_TIMEOUT_MS,
      "Workers AI binding call timed out",
    );
    yield* yieldWorkersAIText(new Response(out));
    return;
  }
  if (env.CF_ACCOUNT_ID && env.CF_AI_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${req.model}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CF_AI_API_TOKEN}` },
      body: JSON.stringify({ messages, max_tokens: maxTokens, stream: true }),
      signal: upstreamSignal(clientSignal),
    });
    if (!resp.ok) throw await httpError(resp, "workers_ai");
    yield* yieldWorkersAIText(resp);
    return;
  }
  throw new LLMError("Workers AI unavailable (no binding / no REST creds)", 501);
}
