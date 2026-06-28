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
});
