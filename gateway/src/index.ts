// index.ts — slidegen 認証付き LLM ゲートウェイ (Hono)。
//
// 役割: ブラウザからの LLM 呼び出しを中継する“だけ”。pptx 生成はブラウザ側
// (Pyodide) が担うため、本 Worker は I/O 中継のみで CPU をほぼ消費しない
// （無料枠の 10ms CPU 制限に収まる）。
//
// エンドポイント:
//   GET  /api/models  利用可能モデル一覧（secret の有無で絞る）
//   POST /api/chat    {modelId, system?, messages[]} を受け LLM へ中継（鍵注入）
//   GET  /api/health  認証不要のヘルスチェック
import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyAccess } from "./auth";
import { checkRateLimit } from "./ratelimit";
import {
  availableModels, chat, findModel, LLMError,
  type ChatMessage, type ModelEntry, type ProviderEnv,
} from "./providers";

type Env = ProviderEnv & {
  RL?: KVNamespace;
  ALLOWED_ORIGIN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_BYPASS_AUTH?: string;
  MAX_INPUT_BYTES?: string;
  RATE_WINDOW_SEC?: string;
  RATE_MAX_REQUESTS?: string;
};

const app = new Hono<{ Bindings: Env; Variables: { email: string } }>();

// --- CORS: フロント(Pages)オリジン限定 + credentials 許可 ---
app.use("/api/*", async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN || "http://localhost:5173";
  return cors({
    origin,
    credentials: true,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })(c, next);
});

app.get("/api/health", (c) => c.json({ ok: true }));

// --- 認証ミドルウェア（health 以外の /api/* 全て） ---
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health") return next();
  const auth = await verifyAccess(c.req.raw, c.env);
  if (!auth.ok) {
    return c.json({ error: auth.error || "unauthorized" }, auth.status as 401 | 500);
  }
  c.set("email", auth.email || "unknown");
  return next();
});

// --- レート制限（認証後） ---
app.use("/api/chat", async (c, next) => {
  const key = c.get("email") || "anon";
  const rl = await checkRateLimit(key, c.env);
  if (!rl.ok) {
    return c.json({ error: "rate limited" }, 429, { "Retry-After": String(rl.retryAfter ?? 60) });
  }
  return next();
});

app.get("/api/models", (c) => {
  const models = availableModels(c.env).map((m) => ({
    id: m.id, label: m.label, tier: m.tier,
  }));
  return c.json({ models });
});

interface ChatBody {
  modelId: string;
  system?: string;
  messages: ChatMessage[];
  // フォールバック許可（同 tier の別プロバイダへ）。既定 true。
  allowFallback?: boolean;
}

app.post("/api/chat", async (c) => {
  // 入力サイズのサーバ強制（鍵暴走課金防止）
  const maxBytes = parseInt(c.env.MAX_INPUT_BYTES || "200000", 10);
  const raw = await c.req.raw.clone().text();
  if (raw.length > maxBytes) {
    return c.json({ error: `input too large (>${maxBytes} bytes)` }, 413);
  }

  let body: ChatBody;
  try {
    body = JSON.parse(raw) as ChatBody;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.modelId || !Array.isArray(body.messages)) {
    return c.json({ error: "modelId and messages[] required" }, 400);
  }

  const primary = findModel(body.modelId);
  if (!primary) return c.json({ error: `unknown modelId: ${body.modelId}` }, 400);

  // フォールバック順: 指定モデル → 同 tier の利用可能モデル（別プロバイダ）
  const usable = availableModels(c.env);
  const chain: ModelEntry[] = [primary];
  if (body.allowFallback !== false) {
    for (const m of usable) {
      if (m.id !== primary.id && m.tier === primary.tier && m.provider !== primary.provider) {
        chain.push(m);
      }
    }
  }

  let lastErr: LLMError | undefined;
  for (const m of chain) {
    try {
      const res = await chat(
        { provider: m.provider, model: m.model, system: body.system, messages: body.messages },
        c.env,
      );
      return c.json({ text: res.text, provider: res.provider, model: m.id });
    } catch (e) {
      lastErr = e instanceof LLMError ? e : new LLMError(String(e));
      // リトライ不可（401/400 等）なら即停止。429/5xx は次プロバイダへ。
      if (!lastErr.retryable) break;
    }
  }
  return c.json(
    { error: lastErr?.message || "all providers failed" },
    (lastErr?.status as 401 | 429 | 502) || 502,
  );
});

export default app;
