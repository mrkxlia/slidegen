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
  availableModels, fallbackChain, findModel, LLMError,
  type ChatMessage, type ProviderEnv,
} from "./providers";
import { streamDeltas } from "./stream";

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
    // DSL 無効時フォールバックの選択にフロントが使う（未指定=信頼可）。
    reliableForDsl: m.reliableForDsl !== false,
    // 画像入力対応か（未指定=非対応）。フロントは vision モデル選択時のみ添付画像を送る。
    vision: m.vision === true,
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

// 添付画像の入力検証（/api/chat）。クライアント側で縮小済みの前提だが、サーバでも強制する。
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_B64_CHARS = 300_000; // base64 で約220KB 相当/枚
const MAX_IMAGES_PER_REQUEST = 4;

app.post("/api/chat", async (c) => {
  // 入力サイズのサーバ強制（鍵暴走課金防止）。
  // マルチバイト(日本語等)で過小評価しないよう、UTF-16 長ではなく UTF-8 バイト数で判定する。
  // 既定 1MB: 添付画像(base64・最大4枚×約220KB)＋本文が収まる値。Access+レート制限下の
  // 暴走課金ガードとしては依然有効（旧既定は 200KB＝テキストのみ時代の値）。
  const maxBytes = parseInt(c.env.MAX_INPUT_BYTES || "1000000", 10);
  const raw = await c.req.raw.clone().text();
  if (new TextEncoder().encode(raw).length > maxBytes) {
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

  // 添付画像の検証（mime allowlist・1枚サイズ・総数）。
  let imageCount = 0;
  for (const m of body.messages) {
    if (m.images === undefined) continue;
    if (!Array.isArray(m.images)) return c.json({ error: "images must be an array" }, 400);
    for (const im of m.images) {
      imageCount++;
      if (imageCount > MAX_IMAGES_PER_REQUEST) {
        return c.json({ error: `too many images (>${MAX_IMAGES_PER_REQUEST})` }, 400);
      }
      if (!im || typeof im.mimeType !== "string" || !ALLOWED_IMAGE_MIME.has(im.mimeType)) {
        return c.json({ error: "unsupported image mimeType" }, 400);
      }
      if (typeof im.data !== "string" || im.data.length === 0 || im.data.length > MAX_IMAGE_B64_CHARS) {
        return c.json({ error: `image too large (>${MAX_IMAGE_B64_CHARS} base64 chars)` }, 400);
      }
    }
  }

  const primary = findModel(body.modelId);
  if (!primary) return c.json({ error: `unknown modelId: ${body.modelId}` }, 400);

  // フォールバック候補チェーン（同 tier の別モデルへ。allowFallback=false で primary のみ）。
  // 全 free が gemini の構成でも機能するよう、同プロバイダ・別モデルも対象（fallbackChain）。
  const chain = body.allowFallback === false ? [primary] : fallbackChain(primary.id, c.env);

  // --- ストリーミング(SSE) 専用 ---
  // delta=`data:{"delta":"..."}`、モデル切替=`data:{"switch":"<id>"}`、
  // 終了=`data:{"done":true}`、失敗=`data:{"error":"..."}`。
  // チェーンを上から試し、エラー種別を問わず候補が残れば次モデルへ続行（404/400 でも止めない）。
  // 既に出力(acc)が始まっていたら、部分出力を引き継いで別モデルに継続させる。
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let acc = "";
      let lastErr: LLMError | undefined;
      let okModelId: string | undefined;
      // 直近の失敗が「空応答(delta ゼロ)」起因か。全滅時の error に code:"empty" を付けるかの判定に使う
      // （HTTP エラー等で全滅したのに empty 扱いしてフロントが誤メッセージを出すのを防ぐ）。
      let lastWasEmpty = false;
      for (let i = 0; i < chain.length; i++) {
        const m = chain[i];
        const before = acc.length;
        if (i > 0) send({ switch: m.id });
        const msgs: ChatMessage[] = acc
          ? [
              ...body.messages,
              { role: "assistant", content: acc },
              { role: "user", content: "前のモデルが上限に達しました。上の途中までの内容に自然に続けて、重複せず最後まで出力してください。" },
            ]
          : body.messages;
        try {
          for await (const delta of streamDeltas(
            // vision は各モデル自身のフラグを渡す（非 vision へのフォールバック時はエンコーダが images を剥がす）。
            { provider: m.provider, model: m.model, system: body.system, messages: msgs, noSystemInstruction: m.noSystemInstruction, vision: m.vision },
            c.env,
          )) {
            acc += delta;
            send({ delta });
          }
        } catch (e) {
          lastErr = e instanceof LLMError ? e : new LLMError(String(e));
          lastWasEmpty = false;
          continue; // 途中 throw 後に下の成功判定へ落ちないよう次候補へ
        }
        // 新たな delta を出したモデルだけ成功扱い。delta ゼロ(=safety/空生成)は失敗として次候補へ。
        if (acc.length > before) {
          okModelId = m.id;
          break;
        }
        lastErr = new LLMError("model returned empty response", 502, true);
        lastWasEmpty = true;
      }
      if (okModelId) {
        send({ done: true, model: okModelId });
      } else {
        send({
          error: lastErr?.message ?? "all models failed",
          status: lastErr?.status ?? 502,
          ...(lastWasEmpty ? { code: "empty" } : {}),
        });
      }
      ctrl.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export default app;
