// renderClient.ts — render-worker.js(Pyodide) を駆動するクライアント。
// Pyodide は CDN から読み込む（SharedArrayBuffer 不要 = COOP/COEP 不要）。

const PYODIDE_URL =
  import.meta.env.VITE_PYODIDE_URL ?? "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
// 既定値はハッシュ無しの素朴なパス。実際の配信URLは内容ハッシュ付きディレクトリ
// （tools/build_wheel.sh が .env.local の VITE_WHEEL_URL に出力）なので、本番/ローカルとも
// env で上書きする前提。env 欠落時はこの既定パスが 404 になりうる点に注意。
// 版の真実は pyproject.toml。ここの版表記はそれと同期（tests/test_version_sync.py がガード）。
const WHEEL_URL = import.meta.env.VITE_WHEEL_URL ?? "/wheels/slidegen-0.1.0-py3-none-any.whl";

export type RenderStage =
  | "idle" | "loading-pyodide" | "loading-micropip"
  | "installing-slidegen" | "warming-up" | "ready" | "error";

type ProgressCb = (stage: RenderStage) => void;

export interface TemplateFile { name: string; bytes: ArrayBuffer; byteLength: number; }

export interface SlidePreview {
  type: string;
  headline: string;
  kicker: string;
  foot: string;
  columns: string[];
  blocks: { title: string; highlight: boolean; lines: string[]; rows: string[][] }[];
}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

export function initRenderer(onProgress?: ProgressCb): Promise<void> {
  if (readyPromise) return readyPromise;
  worker = new Worker("/render-worker.js"); // classic worker（public 配信）
  readyPromise = new Promise<void>((resolve, reject) => {
    worker!.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      switch (msg.type) {
        case "progress": onProgress?.(msg.stage as RenderStage); break;
        case "ready": onProgress?.("ready"); resolve(); break;
        case "error": onProgress?.("error"); reject(new Error(msg.error)); break;
        case "rendered":
        case "previewed":
        case "inspected": {
          const p = pending.get(msg.id);
          if (p) {
            pending.delete(msg.id);
            p.resolve(msg.type === "rendered" ? msg.bytes : msg.type === "previewed" ? msg.slides : msg.spec);
          }
          break;
        }
        case "render-error":
        case "preview-error":
        case "inspect-error": {
          const p = pending.get(msg.id);
          if (p) { pending.delete(msg.id); p.reject(new Error(msg.error)); }
          break;
        }
      }
    };
    worker!.onerror = (e) => { onProgress?.("error"); reject(new Error(e.message)); };
    worker!.postMessage({ type: "init", pyodideUrl: PYODIDE_URL, wheelUrl: WHEEL_URL });
  });
  return readyPromise;
}

// DSL → pptx bytes。template 指定時は会社テンプレ(.potx/.pptx)を土台にする。失敗は reject。
export async function renderDsl(dsl: string, template?: TemplateFile): Promise<Uint8Array> {
  if (!worker || !readyPromise) await initRenderer();
  await readyPromise;
  const id = ++reqId;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // template は再利用するため転送せずコピー（サイズは小さい）。
    worker!.postMessage({ type: "render", id, dsl, template });
  });
}

// DSL をパースしてスライド構成を返す（構成プレビュー）。
export async function previewDsl(dsl: string): Promise<SlidePreview[]> {
  if (!worker || !readyPromise) await initRenderer();
  await readyPromise;
  const id = ++reqId;
  return new Promise<SlidePreview[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ type: "preview", id, dsl });
  });
}

// 既存 pptx の構造スペック（LLM向けテキスト）を抽出する（デザイン取り込み用）。
// サイズ上限（30枚・スライドあたり文字数）は Python 側 inspect_compact が保証。
export async function inspectPptx(pptx: TemplateFile): Promise<string> {
  if (!worker || !readyPromise) await initRenderer();
  await readyPromise;
  const id = ++reqId;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ type: "inspect", id, pptx });
  });
}

// pptx をダウンロードさせる。
export function downloadPptx(bytes: Uint8Array, filename = "slides.pptx") {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
