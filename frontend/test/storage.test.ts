import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings } from "../src/storage";

// localStorage の最小スタブ（node 環境）
beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("settings persistence", () => {
  it("保存した設定を復元できる", () => {
    saveSettings({ modelId: "gemini-2.0-flash", purpose: "意思決定・承認を得る提案" });
    const s = loadSettings();
    expect(s.modelId).toBe("gemini-2.0-flash");
    expect(s.purpose).toBe("意思決定・承認を得る提案");
  });

  it("未保存なら空オブジェクト", () => {
    expect(loadSettings()).toEqual({});
  });

  it("壊れたJSONでも例外を投げない", () => {
    localStorage.setItem("slidegen.settings.v1", "{not json");
    expect(loadSettings()).toEqual({});
  });
});
