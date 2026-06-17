// providers.ts — LLM プロバイダ横断の抽象化（全て async fetch）。
//
// 旧 llm_providers.py(同期SDK・Azure中心) の置き換え。Cloudflare Worker は
// 非同期 HTTP のみ許可されるため、各プロバイダを fetch で実装する。
//
// セキュリティ(SSRF不変条件): エンドポイント URL は本ファイル内に固定し、
//   フロントからは URL/base_url を一切受け取らない。受け取るのは
//   provider(列挙)・model・system・messages のみ。
//
// 移植性: workers_ai のみ Cloudflare 依存（env.AI バインディング）。Node/Bun へ
//   移植する場合は catalog から workers_ai を外し gemini/openrouter に倒す。
export type Provider =
  | "gemini"
  | "openrouter"
  | "workers_ai"
  | "openai"
  | "anthropic";

export type Tier = "free" | "prod";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  provider: Provider;
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  provider: Provider;
  model: string;
}

export class LLMError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status = 502, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export interface ProviderEnv {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_AI_API_TOKEN?: string;
}

export interface ModelEntry {
  id: string; // 表示用ID
  label: string;
  provider: Provider;
  model: string; // 実モデル名
  tier: Tier;
}

// 表示モデル一覧。free=テスト用(無料枠) / prod=本番(要 secret)。
const CATALOG: ModelEntry[] = [
  // --- 無料枠（テスト） ---
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (無料)", provider: "gemini", model: "gemini-2.0-flash", tier: "free" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (無料)", provider: "gemini", model: "gemini-2.5-flash", tier: "free" },
  { id: "or-deepseek-r1", label: "OpenRouter: DeepSeek R1 (無料)", provider: "openrouter", model: "deepseek/deepseek-r1:free", tier: "free" },
  { id: "or-llama-3.3-70b", label: "OpenRouter: Llama 3.3 70B (無料)", provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", tier: "free" },
  { id: "wai-llama-3.3-70b", label: "Workers AI: Llama 3.3 70B (無料)", provider: "workers_ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", tier: "free" },
  // --- 本番（要 API キー） ---
  { id: "gpt-4o", label: "OpenAI: GPT-4o (本番)", provider: "openai", model: "gpt-4o", tier: "prod" },
  { id: "claude-sonnet", label: "Anthropic: Claude Sonnet (本番)", provider: "anthropic", model: "claude-sonnet-4-6", tier: "prod" },
];

// secret の有無で「実際に使えるモデルだけ」を返す。
export function availableModels(env: ProviderEnv): ModelEntry[] {
  return CATALOG.filter((m) => {
    switch (m.provider) {
      case "gemini":
        return !!env.GEMINI_API_KEY;
      case "openrouter":
        return !!env.OPENROUTER_API_KEY;
      case "workers_ai":
        return !!env.AI || (!!env.CF_ACCOUNT_ID && !!env.CF_AI_API_TOKEN);
      case "openai":
        return !!env.OPENAI_API_KEY;
      case "anthropic":
        return !!env.ANTHROPIC_API_KEY;
      default:
        return false;
    }
  });
}

export function findModel(id: string): ModelEntry | undefined {
  return CATALOG.find((m) => m.id === id);
}

export async function chat(req: ChatRequest, env: ProviderEnv): Promise<ChatResult> {
  const maxTokens = req.maxTokens ?? 4096;
  const temperature = req.temperature ?? 0.4;
  let text: string;
  switch (req.provider) {
    case "gemini":
      text = await chatGemini(req, env, maxTokens, temperature);
      break;
    case "openrouter":
      text = await chatOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        env.OPENROUTER_API_KEY,
        req, maxTokens, temperature,
        { "HTTP-Referer": "https://slidegen.app", "X-Title": "slidegen" },
      );
      break;
    case "openai":
      text = await chatOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        env.OPENAI_API_KEY, req, maxTokens, temperature,
      );
      break;
    case "anthropic":
      text = await chatAnthropic(req, env, maxTokens, temperature);
      break;
    case "workers_ai":
      text = await chatWorkersAI(req, env, maxTokens);
      break;
    default:
      throw new LLMError(`unsupported provider: ${req.provider}`, 400);
  }
  return { text, provider: req.provider, model: req.model };
}

// --- Gemini (Google AI Studio) ---
async function chatGemini(req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new LLMError("GEMINI_API_KEY not set", 401);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
  const contents = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw await httpError(resp, "gemini");
  const data = (await resp.json()) as any;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("");
}

// --- OpenAI 互換 (OpenRouter / OpenAI) ---
async function chatOpenAICompatible(
  url: string, apiKey: string | undefined, req: ChatRequest,
  maxTokens: number, temperature: number, extraHeaders: Record<string, string> = {},
): Promise<string> {
  if (!apiKey) throw new LLMError("API key not set", 401);
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    ...req.messages,
  ];
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model: req.model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!resp.ok) throw await httpError(resp, "openai-compatible");
  const data = (await resp.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

// --- Anthropic (本番) ---
async function chatAnthropic(req: ChatRequest, env: ProviderEnv, maxTokens: number, temperature: number): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new LLMError("ANTHROPIC_API_KEY not set", 401);
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model,
      system: req.system || undefined,
      max_tokens: maxTokens,
      temperature,
      messages: req.messages,
    }),
  });
  if (!resp.ok) throw await httpError(resp, "anthropic");
  const data = (await resp.json()) as any;
  return (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

// --- Cloudflare Workers AI (binding 優先 / REST フォールバック) ---
async function chatWorkersAI(req: ChatRequest, env: ProviderEnv, maxTokens: number): Promise<string> {
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    ...req.messages,
  ];
  if (env.AI) {
    const out = (await env.AI.run(req.model, { messages, max_tokens: maxTokens })) as any;
    return out?.response ?? "";
  }
  // REST フォールバック（同一 CF アカウント内で binding が無い環境用）
  if (env.CF_ACCOUNT_ID && env.CF_AI_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${req.model}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.CF_AI_API_TOKEN}` },
      body: JSON.stringify({ messages, max_tokens: maxTokens }),
    });
    if (!resp.ok) throw await httpError(resp, "workers_ai");
    const data = (await resp.json()) as any;
    return data?.result?.response ?? "";
  }
  throw new LLMError("Workers AI unavailable (no binding / no REST creds)", 501);
}

async function httpError(resp: Response, who: string): Promise<LLMError> {
  const body = await resp.text().catch(() => "");
  const retryable = resp.status === 429 || resp.status >= 500;
  return new LLMError(`${who} ${resp.status}: ${body.slice(0, 300)}`, resp.status, retryable);
}
