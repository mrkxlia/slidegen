import { describe, it, expect } from "vitest";
import { availableModels, findModel, type ProviderEnv } from "../src/providers";

describe("availableModels", () => {
  it("secret 未設定なら無料モデルも出ない", () => {
    expect(availableModels({})).toHaveLength(0);
  });

  it("GEMINI_API_KEY があれば gemini モデルのみ出る", () => {
    const env: ProviderEnv = { GEMINI_API_KEY: "x" };
    const ids = availableModels(env).map((m) => m.id);
    expect(ids).toContain("gemini-2.0-flash");
    expect(ids.every((i) => i.startsWith("gemini"))).toBe(true);
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
});

describe("findModel", () => {
  it("既知IDを解決し、未知は undefined", () => {
    expect(findModel("gemini-2.0-flash")?.provider).toBe("gemini");
    expect(findModel("nope")).toBeUndefined();
  });
});
