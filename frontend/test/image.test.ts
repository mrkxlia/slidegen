// image.ts の純関数（縮小サイズ計算・送信予算）のテスト。
// ビットマップ縮小本体（downscaleImage）は canvas 依存のため jsdom では対象外（実機/E2E 確認）。
import { describe, it, expect } from "vitest";
import { scaleToFit, fitsImageBudget, IMAGE_MAX_DIM, IMAGE_MAX_B64_CHARS, MAX_IMAGES_PER_REQUEST } from "../src/image";

describe("scaleToFit", () => {
  it("長辺が上限以下ならそのまま（拡大しない）", () => {
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("横長は長辺を上限に合わせ、縦横比を保つ", () => {
    const r = scaleToFit(4000, 2000);
    expect(r.width).toBe(IMAGE_MAX_DIM);
    expect(r.height).toBe(IMAGE_MAX_DIM / 2);
  });
  it("縦長も同様", () => {
    const r = scaleToFit(1000, 5000);
    expect(r.height).toBe(IMAGE_MAX_DIM);
    expect(r.width).toBe(Math.round((1000 * IMAGE_MAX_DIM) / 5000));
  });
  it("不正サイズは 1x1 に潰す（ゼロ除算防止）", () => {
    expect(scaleToFit(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("fitsImageBudget", () => {
  it("予算内 true / 超過・空 false", () => {
    expect(fitsImageBudget(IMAGE_MAX_B64_CHARS)).toBe(true);
    expect(fitsImageBudget(IMAGE_MAX_B64_CHARS + 1)).toBe(false);
    expect(fitsImageBudget(0)).toBe(false);
  });
  it("gateway 側の上限(30万字)より小さい予算になっている", () => {
    expect(IMAGE_MAX_B64_CHARS).toBeLessThan(300_000);
    expect(MAX_IMAGES_PER_REQUEST).toBeLessThanOrEqual(4);
  });
});
