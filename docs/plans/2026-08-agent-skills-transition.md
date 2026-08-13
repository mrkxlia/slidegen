# 方針転換ロードマップ: Web アプリ → Agent Skills/Plugin 化（2026-08）

> このドキュメントは方針転換の「正」となる実行計画。各セッション着手時はこのファイルを読み、
> 完了したら本ファイルの該当セクションにステータスを追記すること。
> 起点となった検討記録: `/home/kota/.claude/plans/1-agent-skills-ai-agent-logical-globe.md`（ローカル、リポジトリ外）。
> 関連: [backlog.md](../backlog.md) / [adr/](../adr/)

## 背景・目的

slidegen は現在「DSL→編集可能 pptx の純Python ライブラリ」＋「Cloudflare 無料枠で動く壁打ち Web アプリ」の
2階建て構成。方針を転換し、次の4点を進める。

1. スライド作成ロジックを **Agent Skills（オープン仕様）＋プラグイン**として一般化し、Claude Code に限らず
   Codex/Cursor 等の各 AI エージェントから利用可能にする。
2. 未実装の型（`docs/type_catalog.md` の 🔜/📋）の実装を進める。
3. [tsundoku](https://github.com/mrkxlia/tsundoku)（記事クリップ Vault）に蓄積されたスライド作成ノウハウを
   知識抽出し、スキルに反映する。
4. **Cloudflare 関連構成（`frontend/` `gateway/` と CD）を削除**し、純Python ライブラリ＋スキルの構成に戻す。

トークン消費とレビュー粒度の都合上、**1セッション=1PR**を目安に以下へ分割して実行する。

## 決定事項

- CF 関連: **完全削除＋アーカイブタグ**（削除直前のコミットに `archive/cloudflare-webapp` タグを付与し、
  いつでも参照・復元できるようにする）。
- スキル形態: slidegen リポジトリ内で **plugin 化**。Claude Code 専用にせず、新標準
  **Agent Plugins 1.0**（2026-08-06 公開、OpenAI/AWS/Cursor/GitHub/VS Code/Vercel 策定）にも準拠し両対応とする。
- 型実装: 🔜 5型を先に実装 → 📋 約50型を分野別バッチで進める。
- tsundoku: ツールとしては使わず、`library/` のノウハウ記事を知識抽出してスキルの `references/` に反映する。

## 仕様調査で確定した事実（2026-08 時点、実装時の参照用）

- **Agent Skills オープン仕様**（agentskills.io/specification）: SKILL.md の frontmatter は
  `name`（必須・親ディレクトリ名と一致）/ `description`（必須）/ `license` / `compatibility` / `metadata` /
  `allowed-tools` の**6フィールドのみ**。Claude Code 拡張フィールド（`argument-hint` 等）を混ぜると
  claude.ai へのアップロードや Skills API 配布でハードエラーになる → **6フィールド限定で書く**。
  構造は `skill-name/SKILL.md` + `scripts/` + `references/` + `assets/`。本文は 500 行以内推奨（progressive
  disclosure）。検証コマンド: `skills-ref validate ./skill-dir`（github.com/agentskills/agentskills）。
- **Agent Plugins 1.0**（agent-plugins.org、2026-08-06 発表）: リポジトリルートに `plugin.json`
  （必須フィールドは `$schema`="https://agent-plugins.org/schemas/1.0.0/plugin.schema.json" と `name` のみ、
  `additionalProperties: false`）＋ `skills/<name>/SKILL.md` ＋（任意）`mcp.json`。ChatGPT/Codex/Cursor/
  GitHub Copilot/Kiro/VS Code がネイティブ対応。Claude Code へは `npx plugins add` CLI 経由で導入可能。
- **Claude Code plugin**（code.claude.com/docs/en/plugins）: `.claude-plugin/plugin.json`（`name` 必須）＋
  ルート直下 `skills/`。marketplace はルートの `.claude-plugin/marketplace.json`。検証: `claude plugin validate`。
  ローカルテスト: `claude --plugin-dir .`。
- **両形式は同居可能**: ルートの `plugin.json`（Agent Plugins）と `.claude-plugin/plugin.json`（Claude Code）が
  同じ `skills/` ディレクトリを共有できる。参照実装は `github.com/anthropics/skills` の公式 `pptx` スキル
  （SKILL.md 本文＋`scripts/` に Python ヘルパー同梱という構成）。

## リポジトリ調査で確定した事実

- 「教えているのに変換ロジックが無い型」は CI ガード（`tests/test_chart_dsl.py` の
  「`frontend/src/prompts.ts` が教える型 ≡ `RENDERERS`」同値検証）により**存在しない**。
  実装待ちは `docs/type_catalog.md` の **🔜 5型**（priority_matrix_2x2 / quiz_mcq / mandala_chart / sdg_grid /
  conjugation_table — いずれも `grid_2d` の variant として実装可能な設計）と **📋 約50型**（分野別）。
- Cloudflare 削除に対する逆方向依存は2点のみ:
  - `tests/test_chart_dsl.py` — `frontend/src/prompts.ts` を読んで型一致を検証
  - `tests/test_version_sync.py` — `frontend/src/render/renderClient.ts` の既定 wheel URL 版と
    `pyproject.toml` version の一致を検証
  - `slidegen/` 本体・`Makefile`・`pyproject.toml` に frontend/gateway への参照はない。
- `frontend/src/prompts.ts` の DSL リファレンス（全100型カタログ）と `frontend/src/phases.ts` の対話フローが、
  スキルへ移設すべき中核コンテンツ。
- 純Python 時代の「きれいな姿」の原型は初期コミット `592e098`（Web 化は次の PR #2 `9e7fe3d` から）。
- tsundoku はスライド生成ツールではなく記事クリップ Vault。`library/` に「パワポデザインパターン39選」
  「グラフテンプレ10種36枚」「コンサル流スライド構成術」「ロジックツリー活用法」「Claude Skill 設計術」等の
  ノウハウ記事が frontmatter（tags/summary）＋OCR済み本文の形で蓄積されており機械抽出しやすい。

## セッション分割

各セッションはこのファイルの該当セクションに `状況: 未着手/進行中/完了 (PR #xx)` を追記して更新すること。

### S1: Cloudflare 撤去 ＋ DSL リファレンス移設【状況: 完了】

**最優先。他セッションの土台となるため必ず最初に実施。**

> **実施時の訂正**（下記 手順2 の記載誤り）: 「`frontend/src/phases.ts` の対話フロー・
> `IMPORT_DECK_SYSTEM`」とあるが、実際には対話フロー（`PHASE_HEARING`/`PHASE_OUTLINE`/
> `PHASE_DSL`/`PHASE_REVIEW`/`PHASE_REVISE`）も `IMPORT_DECK_SYSTEM` も、すべて
> `frontend/src/prompts.ts` 側にあった（`phases.ts` は応答クリーニング等のユーティリティで、
> 移設すべきプロンプト資産は無かった）。移設は `phase-prompts.md`（対話フロー）と
> `import-deck-prompt.md`（IMPORT_DECK_SYSTEM）に分けて実施した。
>
> **アーカイブタグの付与位置**: 「削除直前のコミット」ではなく、**移設コミット**（Web アプリ・旧
> CI・旧テストが無傷で、かつ `skills/` への移設物とも共存する唯一の時点）に付与した。
> ユーザー承認済みの判断（詳細は [ADR 0007](../adr/0007-retire-webapp-agent-skills.md)）。

1. 削除直前のコミットに Git タグ `archive/cloudflare-webapp` を付与する。
2. 削除より先に移設する:
   - `frontend/src/prompts.ts` の DSL リファレンス全文 → `skills/slidegen/references/dsl-reference.md`
     （S2 の最終配置に直接置いてよい）
   - `frontend/src/phases.ts` の対話フロー・`IMPORT_DECK_SYSTEM` 等 → `skills/slidegen/references/` 配下
     （S2 で SKILL.md 本文に編み込む素材として保存）
   - `tests/test_chart_dsl.py` の CI ガードを `dsl-reference.md` 読み取りに付け替える
     （「教える型 ≡ RENDERERS」の同値検証というテスト目的は維持する）。
     純Python 部分のテスト（`test_all_examples_parse_and_render` / `test_default_template_resolves`）は
     `tests/test_examples.py` 等へ救出する。
3. 削除対象:
   - `frontend/` `gateway/` 丸ごと
   - `tools/build_wheel.sh` `tools/pyodide_spike.mjs` `tools/package.json`（+lock）
   - `tests/test_version_sync.py`
   - `docs/deployment.md` `docs/model-catalog.md`
   - ※ `tools/new_type.py` `tools/visual.py` `slidegen/inspect_pptx.py` は純Python のライブラリ機能なので残す。
4. CI: `.github/workflows/ci.yml` を「`uv build` + `pytest`」中心に縮小し、`deploy` job を削除する。
5. docs 追従:
   - `README.md` / `CLAUDE.md`（プロジェクト側）はほぼ全面書き換え。
   - `requirements.md` の Web アプリ関連セクション（FR-APP/NFR-APP 等）、`spec.md` の §5〜§12
     （Web フロー/ゲートウェイAPI/プロバイダ/認証/配信構成）を刈り込む。
   - ADR は削除ではなく **新規 ADR 0007（Web アプリ撤去と Agent Skills 転換）を追加し、
     0001/0003/0005 を Superseded** にする（`docs/adr/README.md` の「ADR は書き換えない」運用に従う）。
     0006 は `frontend/src/prompts.ts` への参照箇所だけ新配置に修正して存続させる。
   - `docs/backlog.md` を刈り込む（#1 モデルカタログの期日タスク等、Web アプリ前提の項目を Closed 化）。
6. 後片付け（実行前に一覧提示してユーザー確認 — グローバル CLAUDE.md の一時ファイル運用に従う）:
   - 未追跡生成物: 各 `node_modules/`、`frontend/dist/`、`frontend/public/wheels/`、`frontend/.env.local`、
     `frontend/.wrangler/`
   - リポジトリ外: Cloudflare Pages プロジェクト・Access アプリ・Pages secrets、GitHub リポジトリ secrets
     （`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）はユーザー作業として案内する（Claude からは操作不可）。
   - **実施状況（2026-08-13 追記）**: 完了条件（下記7）にリポジトリ外リソースの削除が含まれておらず
     追跡漏れになっていたため、S1 完了報告後もリポジトリ外リソースが残存していた。ユーザー指摘を受けて
     wrangler CLI（既存 OAuth 認証）で実機確認のうえ、以下を実施:
     - Cloudflare Pages プロジェクト `slidegen`（`slidegen-ezt.pages.dev`）＝**削除済み**
       （Pages secrets・Workers AI binding も同時に消滅。ユーザー最終確認のうえ実行）
     - GitHub リポジトリ secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` ＝**削除済み**
     - Worker `slidegen-gateway` ／ KV namespace `RL` ＝実機確認の結果、そもそも作成・デプロイされて
       いなかった（対応不要）
     - Zero Trust Access アプリ（チーム `mrxlia`、AUD `5ac4a021…17c03`）＝wrangler の OAuth スコープでは
       操作不可のため未実施。**ユーザー作業として `docs/backlog.md` に記載**（ダッシュボードでの削除）
     - 同アカウントの無関係プロジェクト（`tsundoku-site` / `mrkxlia-blog`）は対象外・未変更
7. **完了条件**: `uv run --extra dev pytest tests/ -q` が green、CI が green、
   リポジトリ内に CF/Node への現行参照が残らない（docs の歴史的記述・ADR 除く）。
   ＋ リポジトリ外の Cloudflare リソース（Pages プロジェクト・GitHub secrets）の削除
   （2026-08-13 実施済み。Access アプリ削除のみユーザー作業として残存）。

### S2: Agent Skill ＋ 両対応プラグイン化【状況: 完了 (PR #27)】

> **実施時の補足**（2026-08-13）:
> - **履歴のシークレット監査を実施しクリーンを確認**: gitleaks で全コミット走査＋Gemini
>   （`AIzaSy...`）/Cloudflare API トークン/`.dev.vars` を直撃パターンで走査。検出は旧
>   `frontend/wrangler.toml` の `ACCESS_AUD`（Cloudflare Access のアプリ識別子。単体では認証に
>   使えず、当該 Access アプリ自体も S1 後片付けで削除済み）1件のみで、真の秘密は0件。
>   これに基づきユーザー承認のうえ**履歴を書き換えずに public 化**した。
> - `claude plugin validate` は **CI に入れない**（Node/claude CLI セットアップを CI に戻さない
>   ＝ ADR 0007 の縮小方針を維持）。代わりに `Makefile` の `validate-skill` ターゲット
>   （skills-ref validate ＋ `claude plugin validate . --strict` の2連）でローカル運用に固定した。
>   skills-ref は CI では外部リポジトリの破壊的変更を避けるため commit SHA にピン留めしている。
> - `.claude-plugin/plugin.json` と `.claude-plugin/marketplace.json` を両方置く構成では、
>   `claude plugin validate .` は marketplace.json 側を検証する（`plugin.json` を直接指定すると
>   「プラグインルート＝リポジトリルート」の設計上、無関係な `CLAUDE.md` について
>   「plugin root では project context として読み込まれない」という無害な warning が out
>   る。`--strict` はこれもエラー化するため、`validate-skill` では `claude plugin validate .`
>   （marketplace 経由）を使う）。
> - `phase-prompts.md` は SKILL.md から参照しない（各フェーズの要点は SKILL.md 本文に編み込み
>   済みのため二重ロードを避けた。references への保存自体は出自保存・S3 素材として継続）。
> - **SKILL.md には型名を一切列挙しない**運用ルールを採用（CI ガード `test_dsl_reference.py` は
>   `dsl-reference.md` のみを見るため、SKILL.md に型名を書くと未ガードのドリフト源になる）。
>   `tests/test_plugin_manifests.py` の `test_skill_md_does_not_enumerate_type_names` で機械ガード。
> - LICENSE は MIT を新規追加（著作権者表記は `mrkxlia`）。

1. `skills/slidegen/SKILL.md` を作成する。**オープン仕様6フィールドのみ**を使う
   （`compatibility` に "Requires Python 3.10+ and uv" 等を記載）。
   本文には壁打ち→構成提案→DSL記述→レンダの手順（`phases.ts` 由来のフローを編み込む）を書き、
   `references/dsl-reference.md` へは progressive disclosure で誘導する。本文は 500 行以内に収める。
2. `skills/slidegen/scripts/`: レンダ用スクリプトを同梱する。リポジトリ内では `uv run slidegen`、
   リポジトリ外からは `uvx --from git+https://github.com/mrkxlia/slidegen slidegen` で動く自己完結ラッパーとする
   （PyPI 公開は将来のバックログ候補）。
3. プラグイン両対応:
   - ルートに `plugin.json`（Agent Plugins 1.0 形式: `$schema` + `name` + 任意メタデータ）を置く。
     → Codex/Cursor/Copilot 等からは `npx plugins add mrkxlia/slidegen` で導入可能になる。
   - `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` を置く。
     → Claude Code からは `/plugin marketplace add mrkxlia/slidegen` で導入可能になる。
   - 両者は同じ `skills/` ディレクトリを共有する。
4. 検証: `skills-ref validate` と `claude plugin validate` の両方、`claude --plugin-dir .` での実動作確認、
   最低1つの実 pptx 生成 E2E。CI にスキル検証ステップを追加する。
5. `README.md` にエージェント別の導入手順を追記する。
6. **完了条件**: Claude Code から skill 経由で pptx 生成に成功し、両方の validate が green。

### S3: tsundoku 知識抽出 → デザインガイドライン【状況: 完了 (PR #28)】

> **実施時の補足**（2026-08-13）:
> - tsundoku `library/`（`/home/kota/tsundoku`）のスライド関連ノート5本
>   （「パワポのデザインパターン大全 39のアイデア」「全10種36枚のパワポ用グラフテンプレート」
>   「アクセンチュア現役社員が伝授！PowerPointスライド作成の秘訣」「外資系コンサルのスライドに学ぶ
>   ロジックツリー活用法」「定例資料の冒頭に入れるべき1枚のスライド」）を実際に読んで知識抽出し、
>   `skills/slidegen/references/design-guidelines.md`（デザイン原則、各原則に出典タグ＋出典表付き）と
>   `references/type-selection-guide.md`（「したいこと→型名」の逆引き。RENDERERS全100型を突き合わせ）
>   を新設した。SKILL.md の「構成提案」「レビューと修正」の2箇所から両ファイルへ誘導している。
> - `docs/type_catalog.md` §4 に新規📋候補7型（area_chart / pictogram_array / dot_matrix_chart /
>   org_chart / ranking_list / faq_qa / mission_vision_values）と❌候補（キャプチャ画像の羅列・拠点の
>   地図表示・導入実績のロゴ壁）を追記し、既存📋列（funnel/scatter/bubble）をtsundoku実例の頻出度に
>   基づき先頭寄りに並べ替えた。§7出典にtsundokuの1行を追加。
> - 完了条件（references 2本がスキルから参照されている）は `tests/test_plugin_manifests.py` に
>   `test_skill_references_design_guidance_docs` として機械ガードを追加。あわせて
>   `test_type_selection_guide_types_are_registered`（type-selection-guide.md が案内する実装済み型
>   ⊆ RENDERERS）も追加し、dsl-reference.md と同じ「型名は実在するものだけを書く」思想を踏襲した。

1. tsundoku `library/` のスライド関連ノート（frontmatter の `tags`/`summary` で機械抽出）から、
   `skills/slidegen/references/design-guidelines.md`（デザイン原則）と
   `references/type-selection-guide.md`（内容に応じた型の選び方）を編纂する。
2. 抽出した知見をもとに 📋 型の優先順位を見直し、`docs/type_catalog.md` / backlog を更新する。
   新しい型の候補（例: 「39デザインパターン」「グラフテンプレ10種36枚」由来）があれば 🔜/📋 に追記する。
3. **完了条件**: references 2本がスキルから参照されており、型の優先順位が backlog に反映されている。

### S4: 5型の実装【状況: 完了 (PR #29)】

1. `priority_matrix_2x2` / `quiz_mcq` / `mandala_chart` / `sdg_grid` / `conjugation_table` を
   `grid_2d` の variant として実装する（基本は `slidegen/render_base_grid.py` への variant 追記）。
   手順は `docs/type_authoring.md`、雛形生成は `tools/new_type.py` を使う。
2. 各型ごとに: `dsl-reference.md` への追記（CI ガードが強制する）、`examples/*.slide` の追加、
   `make snapshot-update`、`docs/system_prompt.md`・`type_catalog.md`（🔜→✅）の追従を行う。
3. **完了条件**: `RENDERERS` が 105 型になり、全テストが green。

> **実施時の補足**（2026-08-14）:
> - 5型はいずれも既存の `grid_2d` の行×列セルモデル（`Block`=行、`Block.lines`=列セル）にそのまま
>   乗った。新しい `_cell_color` モードは不要で、セル単位の強調は既存の2手段
>   （`col ... highlight` ＝行、本文中の `{ }` ＝特定セル）で完結する。唯一の新規実装は、列見出し帯の
>   有無を切り替える `header` トグル（`_DEFAULT` は不変、`v.get("header", True)` で後方互換を確保）。
>   `mandala_chart`/`sdg_grid`（`row_label: False`）はこのトグルを使い、この2型では
>   `col ... highlight` が無効（`has_rowlabel` ゲート配下で無視される）なので強調は必ず `{ }` を使う
>   よう dsl-reference.md に明記した。
> - `sdg_grid` のカタログ注記「公式色」は theme.py の3色制約（base/main/accent固定・配色70:25:5）と
>   衝突するため不採用とし、自社テーマ内の色に統一した。既存の `swot`
>   （`slidegen/render_frameworks.py` の `_SWOT` テーブルが実世界の4色SWOTを `main`/`muted`/`main_2`/
>   `accent` の4語へ正規化している）が直接の前例。`type_catalog.md` 冒頭の原則
>   （「配色面積比が70:25:5から大きく外れていたら、取り込まずベース寄りに正規化する」）とも整合する。
> - S4着手時の清掃指示どおり、`type_catalog.md` の陳腐化した📋も是正した：`policy_3col`
>   （実装済みなのに📋のままだった）を✅化、`brand_pillars`/`pricing_tiers`（他セクションで既に✅な
>   のに同一ファイル内に重複した📋表記が残存）の重複を解消、`takahashi_oneword`（RENDERERSに存在せず、
>   実装済みの型名は `takahashi`）をトークンごと実装名に訂正の上✅化した。
> - `docs/system_prompt.md` は変更不要と判断した。この文書は「代表的な型」のみを教える非網羅
>   ドキュメントで、`grid_2d` 系は comparison_matrix を含め元々一切掲載されておらず、
>   `test_docs_drift.py` はこの文書について「教える型 ⊆ RENDERERS」のみを検査するため影響なし。

### S5系列: 📋 約50型の分野別バッチ【状況: 未着手】

1セッション=1分野を目安に、S3 で見直した優先順位に沿って並べ替えて実施する。

> **S3(2026-08-13)での追記**: tsundoku知見に基づく新規候補7型（area_chart / pictogram_array /
> dot_matrix_chart / org_chart / ranking_list / faq_qa / mission_vision_values）を
> `docs/type_catalog.md` §4 に追加した。各バッチの最新の型リストは `type_catalog.md` を正とし、
> 下記の分野別バッチの型名列挙・件数は当初調査時点のスナップショットである点に留意すること
> （二重管理・件数の手計算ミスを避けるため、本セクションでの精密な再カウントは行わない）。

- **S5a チャート系（9型）**: bullet / harvey_ball_table / marimekko / sankey / funnel / scatter / bubble /
  treemap / football_field
- **S5b ビジネスフレーム（9型）**: lean_canvas / vpc / five_forces / 3c / 4p / pestel / bcg_matrix /
  empathy_map / persona_card
- **S5c 技術資料（10型）**: code_diff / sql_result / layered_stack 等。**Mermaid 前提の図系
  （sequence_diagram / er_diagram 等）は着手前に方式の設計判断（ADR 候補）を先行させる**。
- **S5d 日本の登壇文化（7型）**
- **S5e 教育・学術（8型）**
- **S5f ストーリー・マーケ＋データ補助（7型）**
- **S5g 個人・イベント（7型）**

各バッチの完了条件は S4 と同じ（型カタログ整合・snapshot 更新・examples 追加・CI green）。

> 注: `type_catalog.md` には実装済みなのに 📋 のまま残っている型があった（policy_3col / brand_pillars /
> pricing_tiers / takahashi 等、カタログの陳腐化）。S4 完了時に清掃済み（詳細は S4 セクションの
> 実施時の補足を参照）。以降も同様の陳腐化が見つかれば都度是正する。

## 進め方の運用ルール

- 各セッション内もステップ単位でユーザー承認を取りながら進める（Engagement workflow の方針）。
- 各セッションの成果は PR 化する。ドキュメント（backlog / 本ファイル / CLAUDE.md）は都度追従させる。
- 順序依存: S1 → S2 は必須順（`skills/` の器と CI 付け替えが先）。S3 は S2 以降いつでも着手可。
  S4/S5 は S1 完了後なら着手可（`dsl-reference.md` 移設後が前提のため実質 S1 後）。

## 参照

- Agent Skills 仕様: https://agentskills.io/specification / https://code.claude.com/docs/en/skills
- Agent Plugins 1.0: https://agent-plugins.org
  （スキーマ: `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`）
  発表記事: https://visualstudiomagazine.com/articles/2026/08/06/vs-code-agent-plugins-go-cross-client-with-new-open-standard.aspx
- Claude Code plugins: https://code.claude.com/docs/en/plugins / https://code.claude.com/docs/en/plugin-marketplaces
- 参照実装（Python 同梱スキル）: https://github.com/anthropics/skills （`pptx` スキル）
- tsundoku: https://github.com/mrkxlia/tsundoku
