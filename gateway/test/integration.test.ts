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

  it("MAX_INPUT_BYTES が数値でなくても既定値(1.5MB)にフォールバックし無効化されない", async () => {
    const big = "x".repeat(1_600_000);
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: big }] }),
    }, { ...baseEnv, MAX_INPUT_BYTES: "not-a-number" });
    expect(res.status).toBe(413);
  });

  it("空の messages[] は 400", async () => {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [] }),
    }, baseEnv);
    expect(res.status).toBe(400);
  });

  it("マルチバイトは UTF-16 長でなく UTF-8 バイト数で 413", async () => {
    // 「あ」は UTF-8 で 3 バイト。char 長(700)は上限 2000 未満だが、
    // バイト長(2100超)は上限超過 → バイト判定でなければ素通りしてしまうケース。
    const ja = "あ".repeat(700);
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: ja }] }),
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

  it("ACCESS_AUD 設定済みなら DEV_BYPASS_AUTH=1 でもバイパスされない（多層防御）", async () => {
    const res = await app.request("/api/models", {}, {
      ALLOWED_ORIGIN: "http://localhost:5173",
      DEV_BYPASS_AUTH: "1",
      ACCESS_TEAM_DOMAIN: "team",
      ACCESS_AUD: "aud123",
    });
    expect(res.status).toBe(401); // JWT 無し → フェイルクローズ側の検証に落ちる
  });

  it("stream: ストリーム途中の in-band error は次候補へフォールバックする", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response(
          'data: {"candidates":[{"content":{"parts":[{"text":"途中"}]}}]}\r\n\r\n' +
          'data: {"error":{"message":"safety block"}}\r\n\r\n',
          { status: 200 },
        );
      }
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"B"}]}}]}\r\n\r\n', { status: 200 });
    }));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"switch"');      // in-band error で次候補へ切替
    expect(text).toContain('"delta":"B"');    // 2モデル目で成功
    expect(text).toContain('"done":true');
    expect(text).not.toContain("safety block"); // 上流の生エラーメッセージは露出しない
  });

  it("stream: 全候補が in-band error なら error イベントで終了する（done は送らない）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response('data: {"error":{"message":"safety block"}}\r\n\r\n', { status: 200 }),
    ));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"error"');
    expect(text).not.toContain('"done":true');
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

  it("stream: 空応答(deltaゼロ)なら次候補へ切替えて成功する", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      // 1回目: content.parts が空 → delta ゼロ（safety/空生成相当）
      if (calls === 1) return new Response('data: {"candidates":[{"content":{"parts":[]}}]}\r\n\r\n', { status: 200 });
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\r\n\r\n', { status: 200 });
    }));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"switch"');      // 空 → 別モデルへ切替
    expect(text).toContain('"delta":"A"');    // 2モデル目で出力
    expect(text).toContain('"done":true');
  });

  it("stream: 全候補が空応答なら error(code:empty) を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response('data: {"candidates":[{"content":{"parts":[]}}]}\r\n\r\n', { status: 200 }),
    ));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const text = await res.text();
    expect(text).toContain('"error"');
    expect(text).toContain('"code":"empty"');
    expect(text).not.toContain('"done":true');
  });

  it("GET /api/models は vision フラグを含む", async () => {
    const res = await app.request("/api/models", {}, baseEnv);
    const body = await res.json();
    const flash = body.models.find((m: any) => m.id === "gemini-2.5-flash");
    const gemma = body.models.find((m: any) => m.id === "gemma-4-31b");
    expect(flash.vision).toBe(true);
    expect(gemma.vision).toBe(false);
  });

  it("images: vision モデルには inline_data として上流へ渡す", async () => {
    let captured: any;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
    }));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: "gemini-2.5-flash", allowFallback: false,
        messages: [{ role: "user", content: "hi", images: [{ mimeType: "image/png", data: "QUJD" }] }],
      }),
    }, baseEnv);
    expect(res.status).toBe(200);
    expect(captured.contents[0].parts[0].inline_data).toEqual({ mime_type: "image/png", data: "QUJD" });
  });

  it("images: 非 vision モデル(Gemma)には剥がしてテキストのみ渡す", async () => {
    let captured: any;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
    }));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: "gemma-4-31b", allowFallback: false,
        messages: [{ role: "user", content: "hi", images: [{ mimeType: "image/png", data: "QUJD" }] }],
      }),
    }, baseEnv);
    expect(res.status).toBe(200);
    expect(JSON.stringify(captured)).not.toContain("inline_data");
    expect(captured.contents[0].parts.every((p: any) => "text" in p)).toBe(true);
  });

  it("images: 未対応 mimeType は 400", async () => {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi", images: [{ mimeType: "image/svg+xml", data: "QUJD" }] }],
      }),
    }, baseEnv);
    expect(res.status).toBe(400);
  });

  it("images: 5枚以上は 400", async () => {
    const images = Array.from({ length: 5 }, () => ({ mimeType: "image/jpeg", data: "QUJD" }));
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi", images }] }),
    }, baseEnv);
    expect(res.status).toBe(400);
  });

  it("images: base64 が上限超なら 400（413 でなく画像検証で弾く）", async () => {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi", images: [{ mimeType: "image/jpeg", data: "A".repeat(300_001) }] }],
      }),
    }, { ...baseEnv, MAX_INPUT_BYTES: "1000000" });
    expect(res.status).toBe(400);
  });

  it("stream: クライアント切断(reader.cancel)で上流 fetch が中断され、フォールバックしない", async () => {
    let calls = 0;
    let secondCallHappened = false;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      calls++;
      if (calls === 1) {
        // fetch 呼び出し側が渡した signal が中断されたら reject する非同期処理を模す。
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      secondCallHappened = true;
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"B"}]}}]}\r\n\r\n', { status: 200 });
    }));
    const res = await app.request("/api/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "hi" }] }),
    }, baseEnv);
    const reader = res.body!.getReader();
    await reader.cancel(); // クライアント切断を模す
    await new Promise((r) => setTimeout(r, 10)); // abort イベント伝播を待つ
    expect(secondCallHappened).toBe(false); // 切断後はフォールバックしない
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
