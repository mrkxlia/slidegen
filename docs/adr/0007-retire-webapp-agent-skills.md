# 0007. Cloudflare Web アプリを撤去し、Agent Skills / プラグイン構成へ転換する

- ステータス: 採用 (Accepted)
- 日付: 2026-08-13
- 関連: [docs/plans/2026-08-agent-skills-transition.md](../plans/2026-08-agent-skills-transition.md),
  [0001](0001-same-origin-pages-functions.md), [0003](0003-browser-pyodide-rendering.md),
  [0005](0005-multi-provider-sse-fallback.md), `skills/slidegen/references/`,
  Git タグ `archive/cloudflare-webapp`

## コンテキスト

slidegen は「DSL→編集可能 pptx の純Python ライブラリ」＋「Cloudflare 無料枠で動く壁打ち Web アプリ」
の2階建て構成として運用してきた（0001/0003/0005 が Web アプリ側の設計判断）。この構成には
継続的な維持コストがあった:

- LLM プロバイダのモデルカタログ（`gateway/src/providers.ts`）は他社の廃止スケジュールに追随して
  棚卸しが必要（実際に 2026-10-16 までの期日付き削除タスクを抱えていた）。
- Cloudflare 無料枠の制約（CPU 時間・Pages Functions のバンドル依存・Access 認証）に合わせた
  設計判断（ブラウザ内 Pyodide でのレンダリング、Pages Functions アダプタ等）が、本体ライブラリの
  スコープ外の保守面積を継続的に生んでいた。
- 一方で 2026-08 に **Agent Skills オープン仕様**（agentskills.io）と**Agent Plugins 1.0**
  （agent-plugins.org、OpenAI/AWS/Cursor/GitHub/VS Code/Vercel 策定）という業界標準が登場し、
  「AI との壁打ちでスライドを作る」という体験は、自前の Web UI を維持しなくても Claude Code や
  Codex/Cursor 等の各エージェント側の対話機能で代替できるようになった。壁打ちフロー・DSL リファレンス
  はいずれも LLM に渡すプロンプト資産であり、Web UI 固有の実装ではなくエージェント共通のスキルとして
  配布する方が自然になった。

## 決定

**Cloudflare Web アプリ（`frontend/` `gateway/` とそれに紐づく CI/CD）を完全に削除**し、
純Python ライブラリ＋ Agent Skills/プラグイン構成に転換する（詳細な移行計画は
[docs/plans/2026-08-agent-skills-transition.md](../plans/2026-08-agent-skills-transition.md)）。

- Web アプリが LLM に渡していたプロンプト資産（DSL リファレンス・壁打ちフェーズの各システム
  プロンプト・pptx 取り込み用プロンプト）は、`skills/slidegen/references/` へ逐語移設した。
  「教える型 ≡ RENDERERS」の CI ガードは、`frontend/src/prompts.ts` ではなく
  `skills/slidegen/references/dsl-reference.md` を読むよう付け替えた（テスト自体の目的は不変）。
- CI は `uv build` + `pytest` 中心に縮小し、Node/wheel 系ステップと Cloudflare Pages への
  deploy job を削除した。
- 削除直前ではなく、**移設コミット時点**（Web アプリ・旧 CI・旧テストが無傷で、かつ新配置とも
  共存する唯一の時点）に Git タグ `archive/cloudflare-webapp` を付与し、いつでも参照・復元
  できるようにした。
- 本 ADR により **0001・0003・0005 を Superseded とする**（0002 の uv 統一、0004 の編集可能
  ネイティブ pptx 出力、0006 の pptx↔DSL 責務分離は Web アプリに依存しない決定のため存続する。
  0006 中の `frontend/src/prompts.ts`（`IMPORT_DECK_SYSTEM`）への参照は
  `skills/slidegen/references/import-deck-prompt.md` へ修正した）。

## 結果

良い点:

- 保守面積が縮小する。他社 LLM プロバイダのモデルカタログ追随、Cloudflare 無料枠の制約に
  合わせた設計、Node/TS 側のビルド・型検査・依存更新が不要になる。
- CI が軽量化し（Node セットアップ・npm ci・vitest・wrangler deploy を除去）、実行時間が短縮する。
- スライド作成ロジックが特定の Web UI に紐づかず、Claude Code に限らず Agent Skills /
  Agent Plugins 1.0 に対応する任意のエージェントから利用可能になる（S2 以降で実装）。

トレードオフ・注意:

- 稼働していた Web アプリ（AI との壁打ち UI）は失われる。復元するには `archive/cloudflare-webapp`
  タグからの再チェックアウトに加え、Cloudflare Pages プロジェクト・Access アプリ・Pages secrets の
  再セットアップが必要（いずれもリポジトリ外のリソースで、Claude からは操作できずユーザー作業）。
- Web アプリ固有の機能（構成プレビュー、添付ファイルのマルチモーダル解析、pptx 取り込みの
  ブラウザ UI 等）は、S2 以降でスキルとして再構築するまで利用できない。

## 検討した代替案

- **Web アプリと新スキル構成を併存させる**: 却下。2系統のプロンプト資産・CI・依存を並行維持する
  コストが、移行期間の短い利便性を上回る。
- **`frontend/`/`gateway/` を削除せずアーカイブ用ブランチへ退避するに留める**: 却下。ブランチは
  誤ってマージされたり、通常の履歴探索で紛れ込んだりするリスクがある。タグの方が「意図的に
  参照しない限り出てこない」性質が復元専用スナップショットに適する。
- **リポジトリを分割し Web アプリ側を別リポジトリへ移動する**: 却下。Web アプリは撤去する方針が
  既に決まっており、分割してまで存続させる価値がない（当面の復元用途にはタグで十分）。
