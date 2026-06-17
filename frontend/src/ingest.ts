// ingest.ts — 添付ファイルから「スライド作成に使える情報」を取り出す。
// 旧 ingest.py の移植（pandas → SheetJS、python-pptx 読取 → JSZip）。
// 返す summary を LLM 文脈に入れ、数値はネイティブチャート型(bar_chart 等)で反映させる。

import * as XLSX from "xlsx";
import JSZip from "jszip";

export type Kind = "table" | "pptx" | "image" | "text" | "unknown";

export interface IngestResult {
  name: string;
  kind: Kind;
  summary: string;
}

export async function ingest(file: File): Promise<IngestResult> {
  const name = file.name;
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const buf = await file.arrayBuffer();

  if (ext === ".xlsx" || ext === ".xls") return ingestTable(name, buf, false);
  if (ext === ".csv" || ext === ".tsv") return ingestTable(name, buf, ext === ".tsv");
  if (ext === ".pptx") return ingestPptx(name, buf);
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext)) {
    return { name, kind: "image",
      summary: `画像ファイル「${name}」（${Math.round(buf.byteLength / 1024)}KB）。参考画像として添付されました。` };
  }
  if (ext === ".txt" || ext === ".md") {
    const txt = new TextDecoder("utf-8").decode(buf);
    return { name, kind: "text", summary: txt.slice(0, 4000) };
  }
  return { name, kind: "unknown", summary: `未対応の形式のファイル「${name}」が添付されました。` };
}

function fmt(n: number): string {
  // python の %.4g 相当（有効4桁）
  return Number(n.toPrecision(4)).toString();
}

function ingestTable(name: string, buf: ArrayBuffer, tsv: boolean): IngestResult {
  let wb: XLSX.WorkBook;
  try {
    wb = tsv
      ? XLSX.read(new TextDecoder().decode(buf), { type: "string", FS: "\t" })
      : XLSX.read(buf, { type: "array" });
  } catch (e) {
    return { name, kind: "table", summary: `表データ「${name}」の読み込み失敗: ${(e as Error).message}` };
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (rows.length === 0) return { name, kind: "table", summary: `表データ「${name}」: 空でした。` };

  const cols = Object.keys(rows[0]);
  const numericCols = cols.filter((c) =>
    rows.every((r) => r[c] === null || r[c] === "" || typeof r[c] === "number" || !isNaN(Number(r[c]))) &&
    rows.some((r) => r[c] !== null && r[c] !== "" && !isNaN(Number(r[c]))),
  );

  const lines: string[] = [`表データ「${name}」: ${rows.length}行 × ${cols.length}列。`, `列: ${cols.join(", ")}`];
  for (const c of numericCols) {
    const vals = rows.map((r) => Number(r[c])).filter((v) => !isNaN(v));
    if (vals.length) {
      const sum = vals.reduce((a, b) => a + b, 0);
      lines.push(`  - 数値列「${c}」: 件数${vals.length}, 合計${fmt(sum)}, ` +
        `最小${fmt(Math.min(...vals))}, 最大${fmt(Math.max(...vals))}, 平均${fmt(sum / vals.length)}`);
    }
  }
  // 先頭プレビュー(CSV)
  const head = XLSX.utils.sheet_to_csv(sheet).split("\n").slice(0, 9).join("\n");
  lines.push("先頭プレビュー(CSV):\n" + head);

  // チャート用ヒント: カテゴリ列1 + 数値列群 → ネイティブ型での書き方を促す
  const catCol = cols.find((c) => !numericCols.includes(c));
  if (catCol && numericCols.length) {
    const labels = rows.slice(0, 12).map((r) => String(r[catCol] ?? ""));
    const chartType = numericCols.length > 1 ? "clustered_bar / line_chart" : "bar_chart";
    lines.push(
      `チャート化のヒント: categories=「${catCol}」(${labels.join(", ")} …)、` +
      `系列=${numericCols.map((c) => `「${c}」`).join(", ")} → ${chartType} 型が適切。`,
    );
  }
  return { name, kind: "table", summary: lines.join("\n") };
}

async function ingestPptx(name: string, buf: ArrayBuffer): Promise<IngestResult> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => slideNum(a) - slideNum(b));
    const chunks: string[] = [`参考スライド「${name}」: ${slidePaths.length}枚。各スライドのテキスト抜粋:`];
    let i = 0;
    for (const p of slidePaths) {
      i++;
      const xml = await zip.files[p].async("string");
      const texts = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1]).filter(Boolean);
      if (texts.length) chunks.push(`[S${i}] ${texts.join(" | ").slice(0, 300)}`);
      if (i >= 30) break;
    }
    return { name, kind: "pptx", summary: chunks.join("\n").slice(0, 6000) };
  } catch (e) {
    return { name, kind: "pptx", summary: `PPTX「${name}」の読み込み失敗: ${(e as Error).message}` };
  }
}

function slideNum(p: string): number {
  const m = p.match(/slide(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 0;
}
