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

// render/preview/inspect 1件あたりのタイムアウト。大型デッキの Pyodide 処理を想定し長め。
const CALL_TIMEOUT_MS = 120_000;

// キャンセル系の失敗を判別するためのエラー型（api.ts の CanceledError と同じ意図）。
export class CanceledError extends Error {}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
// initRenderer() の Promise の reject を外から呼べるように保持する。
// resetWorker() が init 未解決のまま呼ばれた場合（init 中のキャンセル／クラッシュ）に
// これが無いと readyPromise は誰にも解決/拒否されず永久 pending になり、
// それを await している call()/initRenderer() の呼び出し元が恒久ハングする。
let rejectReady: ((e: Error) => void) | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

// worker が死んだ／キャンセルされた／タイムアウトした時の後始末: 全 pending と
// 未解決の readyPromise を reject し、次回 initRenderer() で新しい worker を作れる状態に戻す
// （init 失敗・タイムアウトの永続化を防ぐ）。
function resetWorker(err: Error) {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
  rejectReady?.(err); // 解決済みなら no-op。init 中なら readyPromise を確定させる。
  rejectReady = null;
  worker?.terminate();
  worker = null;
  readyPromise = null;
}

export function initRenderer(onProgress?: ProgressCb): Promise<void> {
  if (readyPromise) return readyPromise;
  worker = new Worker("/render-worker.js"); // classic worker（public 配信）
  readyPromise = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    worker!.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      switch (msg.type) {
        case "progress": onProgress?.(msg.stage as RenderStage); break;
        case "ready": onProgress?.("ready"); rejectReady = null; resolve(); break;
        // worker 側の init 失敗（CDN/micropip 等）。resetWorker() を通さないと worker/readyPromise が
        // 「拒否済みだが非null」のまま残り、以降の call() が毎回この古い拒否を再利用して恒久的に
        // 失敗し続ける（再起動しても直らない）。
        case "error": onProgress?.("error"); resetWorker(new Error(msg.error)); break;
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
    worker!.onerror = (e) => {
      // worker がクラッシュ(Pyodide OOM 等)すると、これが無いと pending は永久に解決せず
      // UI がオーバーレイ表示のまま恒久ハングする。resetWorker() が pending と readyPromise の
      // 両方を reject し、次回呼び出しで新しい worker を起動し直せるようにする。
      onProgress?.("error");
      resetWorker(new Error(e.message));
    };
    worker!.postMessage({ type: "init", pyodideUrl: PYODIDE_URL, wheelUrl: WHEEL_URL });
  });
  return readyPromise;
}

// キャンセル（レンダ中オーバーレイの中断ボタン等）: worker を強制終了し、
// 進行中の全呼び出しを reject する。次の initRenderer() で新しい worker が起動する。
// CanceledError で reject するのは、呼び出し元がユーザー起因の中断と実失敗を区別して
// 誤ったエラーメッセージを表示しないため（api.ts の CanceledError と同じパターン）。
export function terminateRenderer(reason = "キャンセルされました") {
  resetWorker(new CanceledError(reason));
}

// worker への1呼び出しを送り、対応する完了/エラーメッセージを待つ共通ヘルパ。
// タイムアウトと pending の後始末をここに集約する。
async function call<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  if (!worker || !readyPromise) await initRenderer();
  // worker/readyPromise を await の前後でローカルに固定する。モジュール変数を await の
  // 後で読み直すと、待っている間に resetWorker()（クラッシュ／キャンセル）が割り込んで
  // 変数が null に入れ替わり、null 参照で落ちるレースになりうる。
  const w = worker;
  const rp = readyPromise;
  if (!w || !rp) throw new Error("renderer is not initialized");
  await rp;
  if (worker !== w) {
    // 待機中に worker がリセットされた。通常は resetWorker() が pending を reject 済みだが、
    // まだ postMessage 前(pending 未登録)ならここで検知して安全に失敗させる。
    throw new Error("renderer was reset while waiting to become ready");
  }
  const id = ++reqId;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // worker 内の実行キューは1件ずつ直列化されている（render-worker.js の enqueue）。
      // この呼び出しをタイムアウトさせるだけだと、詰まった Python 実行の後ろに並ぶ以降の
      // 全呼び出しも同じ worker を待ち続けて連鎖タイムアウトする。resetWorker() で worker
      // ごと作り直し、以降の呼び出しは新しい worker で正常に処理できるようにする
      // （pending 全件の reject・timer clear は resetWorker 内で行われる）。
      resetWorker(new Error(`${type} がタイムアウトしました（${CALL_TIMEOUT_MS / 1000}秒）`));
    }, CALL_TIMEOUT_MS);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    w.postMessage({ type, id, ...payload });
  });
}

// DSL → pptx bytes。template 指定時は会社テンプレ(.potx/.pptx)を土台にする。失敗は reject。
export function renderDsl(dsl: string, template?: TemplateFile): Promise<Uint8Array> {
  // template は再利用するため転送せずコピー（サイズは小さい）。
  return call<Uint8Array>("render", { dsl, template });
}

// DSL をパースしてスライド構成を返す（構成プレビュー）。
export function previewDsl(dsl: string): Promise<SlidePreview[]> {
  return call<SlidePreview[]>("preview", { dsl });
}

// 既存 pptx の構造スペック（LLM向けテキスト）を抽出する（デザイン取り込み用）。
// サイズ上限（30枚・スライドあたり文字数）は Python 側 inspect_compact が保証。
export function inspectPptx(pptx: TemplateFile): Promise<string> {
  return call<string>("inspect", { pptx });
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
