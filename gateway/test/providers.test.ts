import { describe, it, expect } from "vitest";
import { availableModels, buildGeminiPayload, findModel, type ChatRequest, type ProviderEnv } from "../src/providers";

describe("availableModels", () => {
  it("secret 未設定なら無料モデルも出ない", () => {
    expect(availableModels({})).toHaveLength(0);
  });

  it("GEMINI_API_KEY があれば gemini プロバイダのモデルのみ出る", () => {
    const env: ProviderEnv = { GEMINI_API_KEY: "x" };
    const list = availableModels(env);
    expect(list.map((m) => m.id)).toContain("gemini-2.5-flash");
    // Gemma も provider は "gemini"（同 API/同キー）。id 前提でなく provider で確認。
    expect(list.every((m) => m.provider === "gemini")).toBe(true);
  });

  it("Workers AI は binding だけで有効化される", () => {
    const env: ProviderEnv = { AI: { run: async () => ({}) } };
    const ids = availableModels(env).map((m) => m.id);
    expect(ids).toContain("wai-llama-3.3-70b");
  });

  it("本番キーで prod tier が出る", () => {
    const env: ProviderEnv = { OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "y" };
    const tiers = new Set(availableModels(env).map((m) => m.tier));
    expect(tiers.has("prod")).toBe(true);
  });

  it("reliableForDsl: Gemma は false、それ以外は true（フロントのフォールバック選択用）", () => {
    const list = availableModels({ GEMINI_API_KEY: "x" });
    expect(list.find((m) => m.id.startsWith("gemma"))?.reliableForDsl).toBe(false);
    expect(list.find((m) => m.id.startsWith("gemini"))?.reliableForDsl).toBe(true);
  });

  it("vision: Gemini Flash 系は true、Gemma/Llama/GPT-OSS 系は未指定(=非対応)", () => {
    const env: ProviderEnv = { GEMINI_API_KEY: "x", OPENROUTER_API_KEY: "y" };
    const list = availableModels(env);
    expect(list.find((m) => m.id === "gemini-3.5-flash")?.vision).toBe(true);
    expect(list.find((m) => m.id.startsWith("gemma"))?.vision).toBeFalsy();
    expect(list.find((m) => m.id === "or-gpt-oss-120b")?.vision).toBeFalsy();
  });
});

describe("buildGeminiPayload (images)", () => {
  const req = (vision: boolean): ChatRequest => ({
    provider: "gemini", model: "m", system: "SYS", vision,
    messages: [{ role: "user", content: "hi", images: [{ mimeType: "image/jpeg", data: "QUJD" }] }],
  });

  it("vision のとき inline_data パートを text の前に載せる", () => {
    const body = buildGeminiPayload(req(true), 100, 0.4) as any;
    const parts = body.contents[0].parts;
    expect(parts[0].inline_data).toEqual({ mime_type: "image/jpeg", data: "QUJD" });
    expect(parts[1].text).toBe("hi");
  });

  it("非 vision のとき images を黙って剥がす（フォールバック先が非 vision でも安全）", () => {
    const body = buildGeminiPayload(req(false), 100, 0.4) as any;
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe("hi");
  });
});

describe("findModel", () => {
  it("既知IDを解決し、未知は undefined", () => {
    expect(findModel("gemini-2.5-flash")?.provider).toBe("gemini");
    expect(findModel("nope")).toBeUndefined();
  });
});
