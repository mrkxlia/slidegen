# slidegen 課題・ネクストアクション（backlog）

> 現役の課題・将来項を**優先度順**にまとめる。個人/学習プロジェクトのスコープに合わせ、
> 過剰な作り込みは避ける方針。完了した課題の記録は [history.md](history.md) に移す
> （本ファイルには現役項目だけを残す）。
> 関連: [requirements.md](../requirements.md) / [spec.md](../spec.md) / [docs/adr/](adr/)
> 最終更新: 2026-08-15

## 機能の将来項（中）

- **pptx → DSL の決定的双方向化**（[ADR 0003](adr/0003-provenance-roundtrip.md) の将来項）:
  slidegen 生成 pptx に DSL ソースを埋め込み（プロベナンス方式）、PowerPoint での手編集を
  LLM を介さず元の DSL へ機械的に反映する。比較器は `tests/test_visual_regression.py` の
  図形ツリー正規化シリアライザを流用できる。現状 `sync` は文言差分のみ対応。
- **技術図 Mermaid 連携**（設計の MNP 構想にあるが未実装）。
- **i18n**（現状 日本語のみ）。

## 配布・運用（中〜低）

- **PyPI 公開の検討**: `uvx --from git+...` を GitHub 依存から解放し、バージョン解決も速くなる。
- **skills-ref の commit SHA ピン留めの定期更新**: `Makefile` の `validate-skill` が参照する
  agentskills リポジトリの SHA ピンは、破壊的変更を CI で拾わないためのトレードオフ。
  放置すると古いまま固定されるため定期的に更新する。

## 🟡 ユーザー作業（外部サービスの後片付け。Claude からは操作不可・未実施）

旧構成で使っていた外部リソースの後片付け（経緯は [history.md](history.md) 参照）:

- Cloudflare Zero Trust チーム `mrxlia`（`mrxlia.cloudflareaccess.com`）の Access アプリ削除
  （旧 Pages プロジェクト向け、AUD `5ac4a021…17c03`）とそのポリシー。
- 旧 GitHub secrets に入れていた Cloudflare API トークン本体の失効
  （dash.cloudflare.com → My Profile → API Tokens。Pages:Edit スコープ）。
- LLM API キー（GEMINI_API_KEY / OPENROUTER_API_KEY、任意で OPENAI/ANTHROPIC）のローテーション検討
  （環境変数としては消滅済みだが、キー自体の失効は別途要判断）。

## 意図的に対応しないもの（記録）

- `slidegen/scaffold_type.py` の `# TODO: レイアウト(...)に従って配置を実装` は、新型を起こす際に
  人間が埋める**生成テンプレート内のガイド用プレースホルダ**であり本体の未実装ではない。
  消すとガイドが失われるため意図的に残す。
