// api.ts — gateway(/api/*) クライアント。
// credentials:'include' で Cloudflare Access の Cookie/JWT を載せる。
// Access セッション失効時は 302→HTML ログインが返るため、それを検知して再認証へ誘導する。

import type { Message } from "./phases";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
// チャット 1 リクエストあたりの全体タイムアウト。これを超えたら abort してエラーにする
// （アイドルではなく全体時間。thought 無音での誤中断を避けるためアイドル監視はしない）。
const CHAT_TOTAL_TIMEOUT_MS = 120_000;

export interface ModelInfo { id: string; label: string; tier: "free" | "prod"; reliableForDsl?: boolean; vision?: boolean; }

export class AuthExpiredError extends Error {}
// ユーザーが「停止」した場合に投げる。エラーバナーは出さず静かに中断するために型で区別する。
export class CanceledError extends Error {}
export class ApiError extends Error {
  status: number;
  // ゲートウェイが返す機械可読コード（例: "empty"=全モデル空応答）。UI の文言切替に使う。
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}

async function parseJsonOrReauth(resp: Response): Promise<any> {
  const ct = resp.headers.get("Content-Type") || "";
  // Access 失効: JSON を期待した所に HTML/リダイレクトが返る
  if (resp.redirected || ct.includes("text/html")) {
    throw new AuthExpiredError("Access session expired — re-authentication required");
  }
  let data: any = null;
  try { data = await resp.json(); } catch { /* noop */ }
  if (!resp.ok) {
    if (resp.status === 401) throw new AuthExpiredError(data?.error || "unauthorized");
    throw new ApiError(data?.error || `HTTP ${resp.status}`, resp.status);
  }
  return data;
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const resp = await fetch(`${API_BASE}/api/models`, { credentials: "include" });
  const data = await parseJsonOrReauth(resp);
  return data.models as ModelInfo[];
}

// ストリーミング版 chat。onDelta でトークンを逐次受け取り、完了で全文を resolve。
// opts.signal で外部（停止ボタン）から中断可能。加えて内部で全体タイムアウトを張る。
export async function chatStream(
  args: { modelId: string; system: string; messages: Message[] },
  onDelta: (delta: string, full: string) => void,
  opts?: { signal?: AbortSignal },
): Promise<{ text: string; provider?: string; model?: string }> {
  // 外部 signal（停止ボタン）と内部タイムアウトを 1 つの AbortController に合流させる。
  const ac = new AbortController();
  const relayAbort = () => ac.abort();
  opts?.signal?.addEventListener("abort", relayAbort);
  if (opts?.signal?.aborted) ac.abort();
  const timer = setTimeout(() => ac.abort(), CHAT_TOTAL_TIMEOUT_MS);
  try {
    const resp = await fetch(`${API_BASE}/api/chat?stream=1`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: ac.signal,
    });
    const ct = resp.headers.get("Content-Type") || "";
    // Access 失効: SSE を期待した所に HTML/redirect
    if (resp.redirected || ct.includes("text/html")) {
      throw new AuthExpiredError("Access session expired — re-authentication required");
    }
    if (!resp.ok || !resp.body) {
      // SSE で開けなかった場合は JSON エラーとして処理
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401) throw new AuthExpiredError((data as any)?.error || "unauthorized");
      throw new ApiError((data as any)?.error || `HTTP ${resp.status}`, resp.status, (data as any)?.code);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    let meta: { provider?: string; model?: string } = {};
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const evt = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const obj = JSON.parse(line.slice(5).trim());
        if (obj.error) {
          if (obj.status === 401) throw new AuthExpiredError(obj.error);
          throw new ApiError(obj.error, obj.status || 502, obj.code);
        }
        if (obj.delta) { full += obj.delta; onDelta(obj.delta, full); }
        if (obj.done) meta = { provider: obj.provider, model: obj.model };
      }
    }
    // 保険: error イベントも無いまま空で終わった場合は空応答として扱う（通常はゲートウェイが error を返す）。
    if (full.trim() === "") throw new ApiError("empty response", 502, "empty");
    return { text: full, ...meta };
  } catch (e) {
    // abort 由来: 外部 signal が起点ならユーザー中断、そうでなければタイムアウト。
    if (e instanceof DOMException && e.name === "AbortError") {
      if (opts?.signal?.aborted) throw new CanceledError("canceled");
      throw new ApiError("応答がタイムアウトしました。もう一度お試しください。", 504);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", relayAbort);
  }
}

// 再認証: 現在のページへ戻ってくる形で Access ログインを踏ませる。
export function triggerReauth() {
  // Access 配下なら単純リロードでログイン画面に飛ぶ。
  window.location.reload();
}
