import { describe, it, expect, vi, afterEach } from "vitest";
import { streamDeltas } from "../src/stream";

afterEach(() => vi.restoreAllMocks());

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let s = "";
  for await (const d of gen) s += d;
  return s;
}

describe("streamDeltas (SSE 正規化)", () => {
  it("OpenAI互換(OpenRouter)の delta を連結する", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"こん"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"にちは"}}]}\n\n' +
      "data: [DONE]\n\n";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const out = await collect(
      streamDeltas(
        { provider: "openrouter", model: "m", messages: [{ role: "user", content: "hi" }] },
        { OPENROUTER_API_KEY: "k" },
      ),
    );
    expect(out).toBe("こんにちは");
  });

  it("Gemini の SSE から text を取り出す", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"B"}]}}]}\n\n';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const out = await collect(
      streamDeltas(
        { provider: "gemini", model: "g", messages: [{ role: "user", content: "hi" }] },
        { GEMINI_API_KEY: "k" },
      ),
    );
    expect(out).toBe("AB");
  });

  it("非200はエラーを投げる", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(
      collect(streamDeltas(
        { provider: "openrouter", model: "m", messages: [] },
        { OPENROUTER_API_KEY: "k" },
      )),
    ).rejects.toThrow();
  });

  it("OpenAI互換: ストリーム途中の in-band error は例外を投げる（黙って正常終了しない）", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"途中まで"}}]}\n\n' +
      'data: {"error":{"message":"upstream overloaded"}}\n\n';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const gen = streamDeltas(
      { provider: "openrouter", model: "m", messages: [{ role: "user", content: "hi" }] },
      { OPENROUTER_API_KEY: "k" },
    );
    const first = await gen.next();
    expect(first.value).toBe("途中まで");
    // 上流の生メッセージ(upstream overloaded)はクライアントに露出させない（サーバログにのみ残す）。
    await expect(gen.next()).rejects.toThrow(/^openai-compatible stream error$/);
  });

  it("Gemini: ストリーム途中の in-band error は例外を投げる", async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"A"}]}}]}\n\n' +
      'data: {"error":{"message":"safety block"}}\n\n';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const gen = streamDeltas(
      { provider: "gemini", model: "g", messages: [{ role: "user", content: "hi" }] },
      { GEMINI_API_KEY: "k" },
    );
    await gen.next();
    // 上流の生メッセージ(safety block)はクライアントに露出させない（サーバログにのみ残す）。
    await expect(gen.next()).rejects.toThrow(/^gemini stream error$/);
  });

  it("Anthropic: type:error イベントは例外を投げる", async () => {
    const sse =
      'data: {"type":"content_block_delta","delta":{"text":"A"}}\n\n' +
      'data: {"type":"error","error":{"message":"overloaded_error"}}\n\n';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const gen = streamDeltas(
      { provider: "anthropic", model: "claude", messages: [{ role: "user", content: "hi" }] },
      { ANTHROPIC_API_KEY: "k" },
    );
    await gen.next();
    // 上流の生メッセージ(overloaded_error)はクライアントに露出させない（サーバログにのみ残す）。
    await expect(gen.next()).rejects.toThrow(/^anthropic stream error$/);
  });

  it("sseJson: 終端の \\n\\n を欠いた最終イベントもフラッシュされる", async () => {
    // 末尾に区切りが無いまま body が閉じるケース(接続断・非準拠上流)。
    const sse = 'data: {"choices":[{"delta":{"content":"A"}}]}\n\ndata: {"choices":[{"delta":{"content":"B"}}]}';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const out = await collect(
      streamDeltas(
        { provider: "openrouter", model: "m", messages: [{ role: "user", content: "hi" }] },
        { OPENROUTER_API_KEY: "k" },
      ),
    );
    expect(out).toBe("AB");
  });
});
