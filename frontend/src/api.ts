// api.ts — gateway(/api/*) クライアント。
// credentials:'include' で Cloudflare Access の Cookie/JWT を載せる。
// Access セッション失効時は 302→HTML ログインが返るため、それを検知して再認証へ誘導する。

import type { Message } from "./phases";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface ModelInfo { id: string; label: string; tier: "free" | "prod"; }

export class AuthExpiredError extends Error {}
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
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
export async function chatStream(
  args: { modelId: string; system: string; messages: Message[] },
  onDelta: (delta: string, full: string) => void,
): Promise<{ text: string; provider?: string; model?: string }> {
  const resp = await fetch(`${API_BASE}/api/chat?stream=1`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
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
    throw new ApiError((data as any)?.error || `HTTP ${resp.status}`, resp.status);
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
        throw new ApiError(obj.error, obj.status || 502);
      }
      if (obj.delta) { full += obj.delta; onDelta(obj.delta, full); }
      if (obj.done) meta = { provider: obj.provider, model: obj.model };
    }
  }
  return { text: full, ...meta };
}

// 再認証: 現在のページへ戻ってくる形で Access ログインを踏ませる。
export function triggerReauth() {
  // Access 配下なら単純リロードでログイン画面に飛ぶ。
  window.location.reload();
}
