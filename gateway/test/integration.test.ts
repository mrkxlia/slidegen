// integration.test.ts — Hono app を app.request で叩く API レベル E2E。
// ネットワークは fetch をモックし、認証は DEV_BYPASS_AUTH で通す。
import { describe, it, expect, vi, afterEach } from "vitest";
import app from "../src/index";

const baseEnv = {
  DEV_BYPASS_AUTH: "1",
  ALLOWED_ORIGIN: "http://localhost:5173",
  GEMINI_API_KEY: "test-key",
  RATE_WINDOW_SEC: "3600",
  RATE_MAX_REQUESTS: "5",
  MAX_INPUT_BYTES: "2000",
};

afterEach(() => vi.restoreAllMocks());

describe("gateway API (E2E)", () => {
  it("GET /api/health は認証不要で 200", async () => {
    const res = await app.request("/api/health", {}, {});
    expect(res.status).toBe(200);
  });

  it("GET /api/models は利用可能モデルを返す", async () => {
    const res = await app.request("/api/models", {}, baseEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models.some((m: any) => m.id === "gemini-2.0-flash")).toBe(true);
  });

  it("POST /api/chat は LLM 応答テキストを返す（gemini モック）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "やあ" }] } }] }), { status: 200 }),
    ));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.0-flash", system: "s", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("やあ");
  });

  it("POST /api/chat?stream=1 は SSE で delta と done を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response('data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\n\n', { status: 200 }),
    ));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.0-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"delta":"A"');
    expect(text).toContain('"done":true');
  });

  it("過大な入力は 413", async () => {
    const big = "x".repeat(5000);
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.0-flash", messages: [{ role: "user", content: big }] }),
    }, baseEnv);
    expect(res.status).toBe(413);
  });

  it("レート上限超過で 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 }),
    ));
    const body = JSON.stringify({ modelId: "gemini-2.0-flash", messages: [{ role: "user", content: "hi" }] });
    const req = () => app.request("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body }, baseEnv);
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await req();
    expect(last!.status).toBe(429);
  });

  it("認証未設定(バイパス無し)はフェイルクローズ 500", async () => {
    const res = await app.request("/api/models", {}, { ALLOWED_ORIGIN: "http://localhost:5173" });
    expect(res.status).toBe(500);
  });
});
