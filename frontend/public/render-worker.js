/* render-worker.js — ブラウザ内 pptx 生成ワーカー（Pyodide）。
 *
 * メインスレッドをブロックしないよう Web Worker で Pyodide を常駐させ、
 * slidegen(wheel) を micropip 導入して render_to_bytes(dsl) を実行する。
 *
 * これにより重い CPU 処理（python-pptx のシリアライズ）はクライアントで完結し、
 * Cloudflare Worker の無料 CPU 制限(10ms) を一切受けない。
 *
 * メッセージ:
 *   {type:'init', pyodideUrl, wheelUrl}  → 'ready' | 'progress' | 'error'
 *   {type:'render', id, dsl}             → 'rendered'{id, bytes} | 'render-error'{id, error}
 */
let pyodideReady = null;

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

async function render(id, dsl) {
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set("dsl_text", dsl);
    const proxy = await pyodide.runPythonAsync(
      "import slidegen; slidegen.render_to_bytes(dsl_text)",
    );
    const bytes = proxy.toJs(); // Uint8Array
    proxy.destroy();
    // transferable で渡す
    self.postMessage({ type: "rendered", id, bytes }, [bytes.buffer]);
  } catch (e) {
    self.postMessage({ type: "render-error", id, error: String(e && e.message ? e.message : e) });
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
    await render(msg.id, msg.dsl);
  }
};
