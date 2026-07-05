/* render-worker.js — ブラウザ内 pptx 生成ワーカー（Pyodide）。
 *
 * メインスレッドをブロックしないよう Web Worker で Pyodide を常駐させ、
 * slidegen(wheel) を micropip 導入して render_to_bytes(dsl) を実行する。
 *
 * これにより重い CPU 処理（python-pptx のシリアライズ）はクライアントで完結し、
 * Cloudflare Worker の無料 CPU 制限(10ms) を一切受けない。
 *
 * メッセージ:
 *   {type:'init', pyodideUrl, wheelUrl}        → 'ready' | 'progress' | 'error'
 *   {type:'render', id, dsl, template?}        → 'rendered'{id, bytes} | 'render-error'{id, error}
 *   {type:'preview', id, dsl}                  → 'previewed'{id, slides} | 'preview-error'{id, error}
 *   {type:'inspect', id, pptx}                 → 'inspected'{id, spec} | 'inspect-error'{id, error}
 */
let pyodideReady = null;
// render/preview/inspect は pyodide.globals（dsl_text/tpl_path）と /tmp の固定パスを共有するため、
// 同時実行すると互いのリクエストの入力を上書きしうる。1件ずつ直列化する。
let queue = Promise.resolve();
function enqueue(task) {
  const result = queue.then(task, task);
  queue = result.then(() => {}, () => {});
  return result;
}

async function init(pyodideUrl, wheelUrl) {
  if (pyodideReady) return pyodideReady;
  pyodideReady = (async () => {
    post("progress", { stage: "loading-pyodide" });
    importScripts(pyodideUrl + "pyodide.js");
    // eslint-disable-next-line no-undef
    const pyodide = await loadPyodide({ indexURL: pyodideUrl });

    post("progress", { stage: "loading-micropip" });
    await pyodide.loadPackage("micropip");

    post("progress", { stage: "installing-slidegen" });
    const micropip = pyodide.pyimport("micropip");
    // deps=True で python-pptx → lxml/Pillow/XlsxWriter を自動解決
    await micropip.install(wheelUrl, { deps: true });

    post("progress", { stage: "warming-up" });
    // import を先に済ませて初回 render を速くする
    await pyodide.runPythonAsync("import slidegen");
    post("ready", {});
    return pyodide;
  })();
  return pyodideReady;
}

async function render(id, dsl, template) {
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set("dsl_text", dsl);
    let tplPath = null;
    if (template && template.byteLength) {
      tplPath = "/tmp/template" + (template.name && template.name.endsWith(".potx") ? ".potx" : ".pptx");
      pyodide.FS.writeFile(tplPath, new Uint8Array(template.bytes));
    }
    pyodide.globals.set("tpl_path", tplPath);
    const proxy = await pyodide.runPythonAsync(
      "import slidegen; slidegen.render_to_bytes(dsl_text, template=tpl_path)",
    );
    const bytes = proxy.toJs(); // Uint8Array
    proxy.destroy();
    self.postMessage({ type: "rendered", id, bytes }, [bytes.buffer]);
  } catch (e) {
    self.postMessage({ type: "render-error", id, error: String(e && e.message ? e.message : e) });
  }
}

// DSL を slidegen.parser でパースし、スライド構成(JSON)を返す（構成プレビュー用）。
async function preview(id, dsl) {
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set("dsl_text", dsl);
    const json = await pyodide.runPythonAsync(`
import json
from slidegen.parser import parse
_out = []
for s in parse(dsl_text):
    _out.append({
        "type": s.type,
        "headline": s.props.get("headline", ""),
        "kicker": s.props.get("kicker", ""),
        "foot": s.props.get("foot", ""),
        "columns": s.props.get("columns_list", []),
        "blocks": [{
            "title": b.title, "highlight": b.highlight,
            "lines": list(b.lines), "rows": [list(r) for r in b.rows],
        } for b in s.blocks],
    })
json.dumps(_out, ensure_ascii=False)
`);
    self.postMessage({ type: "previewed", id, slides: JSON.parse(json) });
  } catch (e) {
    self.postMessage({ type: "preview-error", id, error: String(e && e.message ? e.message : e) });
  }
}

// 既存 pptx の構造スペックを抽出する（デザイン取り込み用）。
// サイズ上限は Python 側（inspect_compact）が保証する。
async function inspect(id, pptx) {
  try {
    const pyodide = await pyodideReady;
    const path = "/tmp/import.pptx";
    pyodide.FS.writeFile(path, new Uint8Array(pptx.bytes));
    const spec = await pyodide.runPythonAsync(
      `from slidegen.inspect_pptx import inspect_compact; inspect_compact("${path}")`,
    );
    self.postMessage({ type: "inspected", id, spec });
  } catch (e) {
    self.postMessage({ type: "inspect-error", id, error: String(e && e.message ? e.message : e) });
  }
}

function post(type, extra) {
  self.postMessage({ type, ...extra });
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    try {
      await init(msg.pyodideUrl, msg.wheelUrl);
    } catch (e) {
      post("error", { error: String(e && e.message ? e.message : e) });
    }
  } else if (msg.type === "render") {
    enqueue(() => render(msg.id, msg.dsl, msg.template));
  } else if (msg.type === "preview") {
    enqueue(() => preview(msg.id, msg.dsl));
  } else if (msg.type === "inspect") {
    enqueue(() => inspect(msg.id, msg.pptx));
  }
};
