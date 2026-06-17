// ratelimit.ts — 簡易レート制限。本番 API キーの暴走課金を防ぐサーバ強制ガード。
//
// KV があれば固定窓カウンタ（複数 isolate 横断）、無ければ isolate ローカルの
// メモリ窓でベストエフォート。単一ユーザー用途なので厳密性より「青天井防止」を優先。
export interface RateLimitEnv {
  RL?: KVNamespace;
  RATE_WINDOW_SEC?: string;
  RATE_MAX_REQUESTS?: string;
}

const memWindows = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(key: string, env: RateLimitEnv): Promise<{ ok: boolean; retryAfter?: number }> {
  const windowSec = parseInt(env.RATE_WINDOW_SEC || "60", 10);
  const max = parseInt(env.RATE_MAX_REQUESTS || "30", 10);
  const now = Date.now();
  const bucket = Math.floor(now / 1000 / windowSec);
  const rlKey = `rl:${key}:${bucket}`;

  if (env.RL) {
    const cur = parseInt((await env.RL.get(rlKey)) || "0", 10);
    if (cur >= max) return { ok: false, retryAfter: windowSec };
    await env.RL.put(rlKey, String(cur + 1), { expirationTtl: windowSec * 2 });
    return { ok: true };
  }

  // メモリフォールバック
  const w = memWindows.get(key);
  const resetAt = (bucket + 1) * windowSec * 1000;
  if (!w || w.resetAt !== resetAt) {
    memWindows.set(key, { count: 1, resetAt });
    return { ok: true };
  }
  if (w.count >= max) return { ok: false, retryAfter: Math.ceil((resetAt - now) / 1000) };
  w.count++;
  return { ok: true };
}
