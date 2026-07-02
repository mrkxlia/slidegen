// pyodide_spike.mjs — STEP0 関門: ブラウザ相当(Pyodide)で slidegen が
// pptx を生成できるかを検証する。CDN egress が許可された環境で実行する。
//
//   1) bash tools/build_wheel.sh        # wheel を生成
//   2) node tools/pyodide_spike.mjs     # 本スクリプト
//
// 合格条件: chart 入りサンプルが Pyodide 上で render_to_bytes でき、pptx(zip) が得られる。
import { loadPyodide } from "pyodide";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wheelDir = join(root, "frontend/public/wheels");
const hashDir = readdirSync(wheelDir)[0];
const wheelPath = join(wheelDir, hashDir, readdirSync(join(wheelDir, hashDir))[0]);
const sample = join(root, "examples/charts_frameworks_demo.slide");

console.log("wheel:", wheelPath);
const py = await loadPyodide();
await py.loadPackage("micropip");
const micropip = py.pyimport("micropip");

// micropip は basename を wheel ファイル名として解釈するため、
// 正規の `slidegen-<ver>-py3-none-any.whl` 名で FS に置く（"slidegen.whl" 等は不可）。
const wheelBase = wheelPath.split("/").pop();
py.FS.mkdirTree("/wheels");
py.FS.writeFile(`/wheels/${wheelBase}`, readFileSync(wheelPath));
console.log("installing slidegen + deps (python-pptx → lxml/Pillow/XlsxWriter)…");
await micropip.install(`emfs:/wheels/${wheelBase}`, { deps: true });

py.globals.set("dsl_text", readFileSync(sample, "utf8"));
const [nbytes, nslides] = (
  await py.runPythonAsync(`
import slidegen, io
from pptx import Presentation
b = slidegen.render_to_bytes(dsl_text)        # 本体wheel由来であることを確認
prs = Presentation(io.BytesIO(b))             # 既定テンプレ解決の確認
(len(b), len(prs.slides))
`)
).toJs();

const out = py.runPython("b").toJs();
writeFileSync(join(root, "spike_out.pptx"), Buffer.from(out));
console.log(`✔ STEP0 PASS: ${nbytes} bytes, ${nslides} slides → spike_out.pptx`);

// デザイン取り込み経路: 生成した pptx を FS に置き、inspect_compact が
// ブラウザ相当（worker の inspect メッセージと同じ呼び方）で動くことを確認。
const specLen = await py.runPythonAsync(`
with open("/tmp/import.pptx", "wb") as f:
    f.write(b)
from slidegen.inspect_pptx import inspect_compact
spec = inspect_compact("/tmp/import.pptx")
assert spec.startswith("deck: ") and "[S1]" in spec, spec[:80]
len(spec)
`);
console.log(`✔ inspect PASS: compact spec ${specLen} chars`);
