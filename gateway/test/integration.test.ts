// integration.test.ts — Hono app を app.request で叩く API レベル E2E。
// ネットワークは fetch をモックし、認証は DEV_BYPASS_AUTH で通す。
import { describe, it, expect, vi, afterEach } from "vitest";
import app from "../src/index";

const baseEnv = {
  DEV_BYPASS_AUTH: "1",
  ALLOWED_ORIGIN: "http://localhost:5173",
  GEMINI_API_KEY: "test-key",
  RATE_WINDOW_SEC: "3600",
  RATE_MAX_REQUESTS: "1000", // 既定は緩め。レート制限テストだけ個別に小さい上限を渡す。
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
    expect(body.models.some((m: any) => m.id === "gemini-2.5-flash")).toBe(true);
  });

  it("POST /api/chat は LLM 応答テキストを返す（gemini モック）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "やあ" }] } }] }), { status: 200 }),
    ));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", system: "s", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("やあ");
  });

  it("POST /api/chat?stream=1 は SSE で delta と done を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response('data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\r\n\r\n', { status: 200 }),
    ));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
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
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: big }] }),
    }, baseEnv);
    expect(res.status).toBe(413);
  });

  it("レート上限超過で 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 }),
    ));
    const body = JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] });
    const req = () => app.request("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body }, { ...baseEnv, RATE_MAX_REQUESTS: "5" });
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await req();
    expect(last!.status).toBe(429);
  });

  it("認証未設定(バイパス無し)はフェイルクローズ 500", async () => {
    const res = await app.request("/api/models", {}, { ALLOWED_ORIGIN: "http://localhost:5173" });
    expect(res.status).toBe(500);
  });

  it("stream: 1回目429→2回目で別モデルに切替えて継続する", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("rate limited", { status: 429 });
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\r\n\r\n', { status: 200 });
    }));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"switch"');     // 別モデルへ切替えた
    expect(text).toContain('"delta":"A"');   // 2モデル目で出力
    expect(text).toContain('"done":true');
  });

  it("stream: 1回目400(非retryable)でも次候補へ続行する", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("bad request", { status: 400 });
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"B"}]}}]}\r\n\r\n', { status: 200 });
    }));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"delta":"B"');   // 400 で止めず次モデルで成功
    expect(text).toContain('"done":true');
  });

  it("Gemma は systemInstruction を付けず system を先頭 user に畳む", async () => {
    let captured: any;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
    }));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemma-4-31b", system: "SYS", messages: [{ role: "user", content: "hi" }], allowFallback: false }),
    }, baseEnv);
    expect(res.status).toBe(200);
    expect(captured.systemInstruction).toBeUndefined();
    expect(captured.contents[0].parts[0].text).toContain("SYS");
    expect(captured.contents[0].parts[0].text).toContain("hi");
  });
});
