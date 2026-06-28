import { describe, it, expect } from "vitest";
import { verifyAccess } from "../src/auth";

const req = (headers: Record<string, string> = {}) =>
  new Request("https://x/api/models", { headers });

describe("verifyAccess", () => {
  it("DEV_BYPASS_AUTH=1 で素通し（ローカル専用）", async () => {
    const r = await verifyAccess(req(), { DEV_BYPASS_AUTH: "1" });
    expect(r.ok).toBe(true);
  });

  it("ACCESS_AUD 未設定はフェイルクローズ(500)", async () => {
    const r = await verifyAccess(req(), { ACCESS_TEAM_DOMAIN: "team" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
  });

  it("設定済みでも JWT 無しは 401", async () => {
    const r = await verifyAccess(req(), { ACCESS_TEAM_DOMAIN: "team", ACCESS_AUD: "aud123" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });
});
