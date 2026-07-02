// prompts.ts のガード（デザイン取り込み用システムプロンプト）。
import { describe, it, expect } from "vitest";
import { IMPORT_DECK_SYSTEM, phaseSystemPrompt } from "../src/prompts";

describe("IMPORT_DECK_SYSTEM", () => {
  it("DSL リファレンスを同梱している（DSL_REFERENCE 連結の欠落を検知）", () => {
    expect(IMPORT_DECK_SYSTEM).toContain("# slidegen DSL リファレンス");
    expect(IMPORT_DECK_SYSTEM).toContain("チャート型の書き方");
  });
  it("再構成方針と出力規約（DSLのみ・--- 区切り）を含む", () => {
    expect(IMPORT_DECK_SYSTEM).toContain("再構成");
    expect(IMPORT_DECK_SYSTEM).toContain("完全再現は目的ではない");
    expect(IMPORT_DECK_SYSTEM).toContain("DSL以外を出力しない");
  });
  it("会話フェーズの system とは独立している（dsl フェーズと非同一）", () => {
    expect(IMPORT_DECK_SYSTEM).not.toBe(phaseSystemPrompt("dsl"));
  });
});
