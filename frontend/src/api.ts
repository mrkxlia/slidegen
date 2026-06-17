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

export async function chat(args: {
  modelId: string;
  system: string;
  messages: Message[];
}): Promise<{ text: string; provider: string; model: string }> {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return parseJsonOrReauth(resp);
}

// 再認証: 現在のページへ戻ってくる形で Access ログインを踏ませる。
export function triggerReauth() {
  // Access 配下なら単純リロードでログイン画面に飛ぶ。
  window.location.reload();
}
