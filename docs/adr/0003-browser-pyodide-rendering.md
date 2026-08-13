# 0003. pptx 生成をブラウザ内 Pyodide で実行する

- ステータス: Superseded by [0007](0007-retire-webapp-agent-skills.md) (2026-08-13)
- 日付: 2026-06-28
- 関連: [0001](0001-same-origin-pages-functions.md), [0004](0004-editable-native-pptx.md), `frontend/src/render/`, `public/render-worker.js`, `tools/build_wheel.sh`

## コンテキスト

Web アプリは全て **Cloudflare 無料枠**で動かす（[requirements.md](../../requirements.md) NFR-APP-1）。しかし pptx 生成（`python-pptx`）はサーバ側で動かしにくい:

- Cloudflare Workers/Pages Functions の無料枠は **CPU 時間が厳しい（≈10ms）**。pptx 組み立ては超過しうる。
- `python-pptx` は **lxml / Pillow（C ネイティブ拡張）**に依存し、そもそも Workers ランタイムでは動かない。
- 無料枠の制約上、常駐サーバ（コンテナ等）も置きたくない。

一方、コアライブラリは**純 Python・ホスト非依存**（NFR-LIB-1）に作ってある。

## 決定

**pptx 生成をブラウザ内 Pyodide（WASM 版 CPython）で実行する。** slidegen を wheel として配布し、
`micropip` でブラウザに導入して、ユーザー端末の CPU で `slidegen.render_to_bytes` を走らせる。
ゲートウェイ（Worker）は **LLM 中継の I/O のみ**を担い CPU をほぼ消費しない。

実装方針:

- `public/render-worker.js`（classic Web Worker）で Pyodide を CDN から読み込み、wheel を micropip で導入。
- `frontend/src/render/renderClient.ts` がワーカーを駆動（`renderDsl` / `previewDsl` / `downloadPptx`）。
- wheel の配信 URL の **basename は正規名 `slidegen-0.1.0-py3-none-any.whl`**（micropip がファイル名を解釈するため）。内容ハッシュは親ディレクトリ名に持たせる（`tools/build_wheel.sh`）。
- SharedArrayBuffer 不要の構成（COOP/COEP 不要）。

## 結果

良い点:

- **無料枠で完結**。サーバ CPU 不要、常駐サーバ不要。スケールはユーザー端末側。
- 同一の純 Python コードが**サーバでもブラウザでも**動く（ライブラリの可搬性をそのまま活用）。
- 機密（DSL 内容）が**端末内で処理**され、生成のためにサーバへ送られない。

トレードオフ・注意:

- **初回数秒のロード**（Pyodide 本体 ＋ wheel ＋ 依存の micropip 導入）。進捗オーバーレイで体感を補う。
- **CDN 到達が前提**（オフライン配信する場合は dist を自前ホスト）。
- ブラウザ単体では **pptx→画像が不可** → 「構成プレビュー」は画素サムネイルでなく型・主張・要素のカードで代替。
- wheel の **basename 正規名制約**（上記）を破ると micropip が解決に失敗する。

## 検討した代替案

- **サーバ側生成（LibreOffice/コンテナ）**: 無料枠外・別ホストが必要。本物のサムネイルは作れるが今回のスコープ外（将来課題）。
- **Workers で python-pptx**: C 拡張依存のため不可。
- **AI に画像/HTML を描かせる**: 編集不可になり [0004](0004-editable-native-pptx.md) の必達要件に反するため却下。
