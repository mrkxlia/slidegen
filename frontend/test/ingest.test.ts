import { describe, it, expect } from "vitest";
import { ingest } from "../src/ingest";

function csvFile(name: string, body: string): File {
  return new File([body], name, { type: "text/csv" });
}

describe("ingest CSV", () => {
  it("数値列を集計し、チャート化ヒントを出す", async () => {
    const r = await ingest(csvFile("sales.csv", "四半期,売上\nQ1,120\nQ2,150\nQ3,135\nQ4,180"));
    expect(r.kind).toBe("table");
    expect(r.summary).toContain("数値列「売上」");
    expect(r.summary).toContain("合計585");          // 120+150+135+180
    expect(r.summary).toContain("最大180");
    expect(r.summary).toContain("チャート化のヒント"); // categories=四半期, 系列=売上 → bar_chart
    expect(r.summary).toContain("bar_chart");
  });

  it("複数数値列は clustered_bar / line_chart を提案", async () => {
    const r = await ingest(csvFile("m.csv", "月,売上,目標\n1月,42,40\n2月,48,50"));
    expect(r.summary).toContain("clustered_bar / line_chart");
  });
});

describe("ingest text/image", () => {
  it("txt はそのまま要約に入る", async () => {
    const r = await ingest(new File(["メモ本文"], "note.txt", { type: "text/plain" }));
    expect(r.kind).toBe("text");
    expect(r.summary).toContain("メモ本文");
  });
  it("画像はメタのみ", async () => {
    const r = await ingest(new File([new Uint8Array(2048)], "p.png", { type: "image/png" }));
    expect(r.kind).toBe("image");
    expect(r.summary).toContain("画像ファイル");
  });
});
