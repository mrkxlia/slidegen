// renderClient.ts — render-worker.js(Pyodide) を駆動するクライアント。
// Pyodide は CDN から読み込む（SharedArrayBuffer 不要 = COOP/COEP 不要）。

const PYODIDE_URL =
  import.meta.env.VITE_PYODIDE_URL ?? "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
const WHEEL_URL = import.meta.env.VITE_WHEEL_URL ?? "/wheels/slidegen-0.1.0-py3-none-any.whl";

export type RenderStage =
  | "idle" | "loading-pyodide" | "loading-micropip"
  | "installing-slidegen" | "warming-up" | "ready" | "error";

type ProgressCb = (stage: RenderStage) => void;

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();

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
        case "rendered": {
          const p = pending.get(msg.id);
          if (p) { pending.delete(msg.id); p.resolve(msg.bytes as Uint8Array); }
          break;
        }
        case "render-error": {
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

// DSL → pptx bytes。失敗（parse エラー等）は reject。
export async function renderDsl(dsl: string): Promise<Uint8Array> {
  if (!worker || !readyPromise) await initRenderer();
  await readyPromise;
  const id = ++reqId;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ type: "render", id, dsl });
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
