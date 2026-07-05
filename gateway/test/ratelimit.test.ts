import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../src/ratelimit";

describe("checkRateLimit (memory)", () => {
  it("上限まで許可し、超過で 429 相当に落ちる", async () => {
    const env = { RATE_WINDOW_SEC: "3600", RATE_MAX_REQUESTS: "3" };
    const key = `user-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit(key, env)).ok).toBe(true);
    }
    const blocked = await checkRateLimit(key, env);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("キーが違えば独立にカウントする", async () => {
    const env = { RATE_WINDOW_SEC: "3600", RATE_MAX_REQUESTS: "1" };
    expect((await checkRateLimit("a", env)).ok).toBe(true);
    expect((await checkRateLimit("b", env)).ok).toBe(true);
  });

  it("RATE_MAX_REQUESTS が数値でなくても既定値(30)にフォールバックし無効化されない", async () => {
    const env = { RATE_WINDOW_SEC: "3600", RATE_MAX_REQUESTS: "not-a-number" };
    const key = `nan-${Math.random()}`;
    for (let i = 0; i < 30; i++) {
      expect((await checkRateLimit(key, env)).ok).toBe(true);
    }
    expect((await checkRateLimit(key, env)).ok).toBe(false); // 31回目でブロック（NaN でフェイルオープンしない）
  });

  it("RATE_WINDOW_SEC が数値でなくても既定値(60)にフォールバックする", async () => {
    const env = { RATE_WINDOW_SEC: "abc", RATE_MAX_REQUESTS: "1" };
    const key = `nan-window-${Math.random()}`;
    expect((await checkRateLimit(key, env)).ok).toBe(true);
    expect((await checkRateLimit(key, env)).ok).toBe(false);
  });
});
