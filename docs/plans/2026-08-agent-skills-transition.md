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

### S5系列: 📋 約50型の分野別バッチ【状況: S5a〜S5g 完了。分野別バッチは一区切り】

1セッション=1分野を目安に、S3 で見直した優先順位に沿って並べ替えて実施する。

> **S3(2026-08-13)での追記**: tsundoku知見に基づく新規候補7型（area_chart / pictogram_array /
> dot_matrix_chart / org_chart / ranking_list / faq_qa / mission_vision_values）を
> `docs/type_catalog.md` §4 に追加した。各バッチの最新の型リストは `type_catalog.md` を正とし、
> 下記の分野別バッチの型名列挙・件数は当初調査時点のスナップショットである点に留意すること
> （二重管理・件数の手計算ミスを避けるため、本セクションでの精密な再カウントは行わない）。

- **S5a チャート系（10型）【完了】**: bullet / harvey_ball_table / marimekko / sankey / funnel /
  scatter / bubble / treemap / football_field / area_chart（当初9型に、S3で📋候補入りした
  area_chart を追加。ユーザー承認済み）。
- **S5b ビジネスフレーム（9型）【完了】**: lean_canvas / vpc / five_forces / 3c / 4p / pestel /
  bcg_matrix / empathy_map / persona_card
- **S5c 技術資料（10型）【完了】**: code_diff / sql_result / sequence_diagram / state_transition /
  er_diagram / layered_stack / cloud_architecture / c4_context / slo_sli_table /
  incident_severity_table。
- **S5d 日本の登壇文化（正味4型。当初スナップショット「7型」のうち2つは既存実装と重複）
  【完了】**: speaker_intro_card / cta_recruit / takeaways_emoji / houkoku_sodan_irai
- **S5e 教育・学術（8型）【完了】**: frayer_model / worked_example / theorem_proof /
  flashcard / imrad_overview / abstract_slide / prisma_flow / consort_flow
- **S5f ストーリー・マーケ＋データ補助（7型）【完了】**: golden_circle / storybrand_sb7 /
  pixar_story_spine / aida_funnel / jtbd_statement / annotated_chart / before_after_metric
- **S5g 個人・イベント・ライフ（7型）【完了】**: elevator_pitch / event_timetable / okr /
  maturity_model / recipe_step / travel_itinerary / smart_goal

各バッチの完了条件は S4 と同じ（型カタログ整合・snapshot 更新・examples 追加・CI green）。

> 注: `type_catalog.md` には実装済みなのに 📋 のまま残っている型があった（policy_3col / brand_pillars /
> pricing_tiers / takahashi 等、カタログの陳腐化）。S4 完了時に清掃済み（詳細は S4 セクションの
> 実施時の補足を参照）。以降も同様の陳腐化が見つかれば都度是正する。

> **S5a 実施時の補足（2026-08-14）**:
> - 実装方式は型ごとに使い分けた：`area_chart`/`scatter`/`bubble` はネイティブ Chart API
>   （`render_charts.py` に集約。`scatter`/`bubble` は `XyChartData`/`BubbleChartData` を使う
>   新関数 `render_xy_chart`、既存の凡例・軸スタイリングは `_style_legend`/`_style_axes` に
>   共通関数抽出）。残り7型（`bullet`/`funnel`/`football_field`/`harvey_ball_table`/`marimekko`/
>   `treemap`/`sankey`）は waterfall・narrative_curve の前例（標準プリセット図形の積み木、
>   回転/flip不使用）を踏襲した図形描画で、新規モジュール `slidegen/render_charts_shapes.py`
>   に実装した（waterfall 自体は `render_data_support.py` に現状維持）。
> - `harvey_ball_table` の部分塗り（25/50/75%）は `MSO_SHAPE.PIE` の `adjustments` を実機検証
>   （`[162, 0]`=25%、`[162, 54]`=50%、`[162, 108]`=75%。いずれも `adj1=162` 固定＝12時起点、
>   時計回り、回転プロパティは不使用）した上で採用した。離散5値の定性記号であり、
>   `type_catalog.md` の「❌円グラフ」判断（角度読み取りの精度問題）とは別物と整理した。
> - `marimekko`/`treemap` の `highlight` は、セル面積が大きく accent 塗りにすると P2
>   （invariants の accent面積8%上限）に抵触しやすいため、**アウトライン枠線＋周辺の識別
>   ラベル（列名・合計等）の文字色のみ**で表現する設計にした（塗りは変えない。線・文字色は
>   P2 の計算対象外）。セル内文字自体は背景とのコントラストを優先し、highlight で色を
>   変えない（ドラフト段階で dsl-reference の記述と実装が食い違っていたため、実装＝枠線のみ
>   に文言を合わせて修正した）。
> - DSL 設計は `parser.py` の制約（`ラベル "v1" "v2"` は2値目以降が捨てられる仕様）を踏まえ、
>   ラベル付き多値行をどの型にも使わない方針にした（scatter/bubble=無ラベル固定 stride 行、
>   bullet/sankey/marimekko=ラベル1値 rows、funnel/treemap/football_field=col 単位）。
> - 新 `bullet`（既存 `bullets`＝箇条書き）・新 `funnel`（既存 `funnel_steps`＝nodes系の定性段）
>   と紛らわしい名前が既存型にあったため、dsl-reference.md と type-selection-guide.md の両方に
>   相互参照を明記した。
> - `RENDERERS` は105→115型（`examples/charts2_demo.slide` を新規追加し、10型を1枚ずつ実演）。
> - `docs/system_prompt.md` は変更不要と判断した（チャート型を含め型名を列挙しない非網羅文書。
>   S4 前例と同じ判断）。

> **S5b 実施時の補足（2026-08-15）**:
> - 9型を実装コストで3グループに分けた。(A) `lean_canvas` は `bmc`（`render_frameworks2.py`）と
>   完全に同一の9セル非対称ジオメトリだったため、`render_bmc` の本体を
>   `_render_canvas9(slide, data, theme, labels)` に抽出しラベルリストだけ差し替える形で共有した
>   （リファクタ前後で `bmc` の golden スナップショットが一致することを確認し、無害を証明してから
>   進めた）。(B) `4p`/`pestel` は `labeled_blocks`（`render_base_labeled.py`）の `VARIANTS` 辞書へ
>   数行追記するだけで済んだ（S4 と同じ経済性）。`pestel` は6項目を3列グリッドで表示するため、
>   grid レイアウトの列数を `variant.get("cols", 2)` で上書き可能にした（既定2のため既存
>   variant の出力は不変）。(C) 専用ジオメトリが要る `vpc`/`five_forces`/`3c`/`bcg_matrix`/
>   `empathy_map`/`persona_card` の6型は、S5a の `render_charts_shapes.py` 前例に倣い新規モジュール
>   `render_frameworks3.py` にまとめた。
> - `vpc` の正式な「square＋circle」ジオメトリは標準図形・回転不使用の制約下で再現できないため、
>   左右2パネル×各3段の矩形（Value Map／Customer Profile）＋中央の双方向矢印に簡略化した
>   （ユーザー承認済みの設計判断ではなく実装上の制約対応）。
> - `3c` はベン図（3円の重なり）ではなく、顧客を頂点にした三角配置カード3枚を採用した
>   （ユーザー承認済み）。理由は `venn2` の実装知見：ベタ塗り円は重なり部が潰れ、各要素に
>   分析項目を箇条書きで入れる用途には向かない。カード間は接続線（`add_connector`）で先に描画し、
>   カードを上に重ねることで三角の関係性を示した。
> - `bcg_matrix` は自由軸の `matrix` 型の variant にはせず、独立型として実装した（象限ラベル・
>   色・軸ラベルがすべて固定の意味論を持ち、`matrix` は逆に「自由な軸ラベル」が前提のため）。
>   dsl-reference.md / type-selection-guide.md の双方に使い分けを明記した。
> - `empathy_map` は Pain/Gain を含む6ブロック構成を採用した（ユーザー承認済み。XPLANE 標準版に
>   相当し、`vpc`/`persona_card` との接続点としての実務価値を優先した）。
> - `persona_card` は写真を実際には配置せず、`MSO_SHAPE.OVAL`（塗りのみ）に名前の頭文字を重ねる
>   プレースホルダとした（画像埋め込みに依存しない設計思想を維持しつつ、編集時に画像塗りへ
>   差し替え可能）。
> - 型名 `3c` は数字始まりだが、`tests/test_dsl_reference.py`/`test_docs_drift.py` の抽出正規表現
>   （`[a-z0-9][a-z0-9_]*`。`5e` 型の前例と同じ扱い）にマッチするため DSL 上の制約はない。
>   Python 識別子は数字始まり不可のため、関数名のみ `render_three_c` とし
>   `R.register("3c", render_three_c)` で登録名と分離した。
> - `RENDERERS` は115→124型（`examples/frameworks3_demo.slide` を新規追加し、経費精算SaaSを
>   題材に9型を1枚ずつ実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4/S5a と同じ、型名を列挙しない非網羅文書）。

> **S5c 実施時の補足（2026-08-15）**:
> - **Mermaidの設計判断**（着手前に先行させると計画に明記されていた点）: 調査の結果、
>   `type_catalog.md` §0 凡例の「Mermaid流用」は当初 `docs/ppt_design_doc.md` の MNP構想で
>   「Mermaid構文をDSL表記のヒントとして流用する」という意味であり、Mermaidでレンダリングして
>   画像として貼る方式ではないと判明した（ADR 0004の画像化絶対禁止と正面衝突するため、画像化は
>   事実上不可能）。`sequence_diagram`/`state_transition`/`er_diagram` の3型とも標準図形
>   （矩形・直線コネクタ・テキスト）の組み合わせのみで実装した。この判断はユーザー確認済みで、
>   S3〜S5bの判断と同等の粒度（新規ADRは作らず本セクションに記録）にとどめた。
> - 10型を実装コストで4グループに分けた。(A) `slo_sli_table`/`incident_severity_table` は
>   `grid_2d`（`render_base_grid.py`）の`VARIANTS`辞書へ数行追記のみ（S4/S5bと同じ経済性）。
>   (B) `cloud_architecture` は `nodes_and_connectors`（`render_base_nodes.py`）の既存
>   `linear` レイアウトをラベルだけ変えて再利用（`value_chain` と同じ手法。新規コードなし）。
>   (C) `code_diff`/`sql_result` は既存 `render_tech.py` を拡張。`_mono_text` に後方互換の
>   任意引数 `line_colors` を追加し（未指定時は既存呼び出し=`code_block`/`terminal`の出力を
>   1バイトも変えない。golden一致で無害を確認してから進めた）、行頭 `+`/`-` で文字色を
>   変える `code_diff` と、クエリパネル＋本物の `add_table` の `sql_result` を追加した。
>   (D) 専用ジオメトリが要る `layered_stack`/`c4_context`/`sequence_diagram`/`state_transition`/
>   `er_diagram` の5型は、S5a/S5bの新モジュール前例に倣い新規 `render_tech_diagrams.py` に
>   まとめた。
> - **回転は使わない設計にした**。既存コード `render.py` の `process` 型に `tri.rotation=90`
>   が残っているが、これは type_catalog.md §6「標準プリセット図形のみ使用（カスタムジオメトリ/
>   回転/flipは禁止）」の原則と矛盾する既存の逸脱であり、新規実装（特に矢印表現が必要な
>   sequence_diagram）では踏襲しなかった。sequence_diagram のメッセージは「参加者間は常に
>   水平」という制約を利用し、既存の `MSO_SHAPE.RIGHT_ARROW`/`LEFT_ARROW`（five_forces等と
>   同じ流儀）を回転せずそのまま使った。state_transition の遷移・er_diagram のリレーションは
>   矢頭を使わず直線コネクタのみとした（`cycle` が「矢印」と呼びつつ実装は無地の直線である
>   既存前例に倣い、方向はラベルテキストと from/to の意味論で伝える）。
> - `sequence_diagram`/`state_transition`/`er_diagram` に共通する記法規約として、「`from`/`to`
>   の rows を持つ col ＝ 接続（メッセージ/遷移/リレーション）を表すブロック」を新設した
>   （er_diagram はこれを使って「from/toを持たないcol=エンティティ」との判定も行う）。
>   dsl-referenceに一度だけ説明し3型から参照する形にした。
> - `layered_stack`/`er_diagram` の `highlight` は、当初 accent 塗りで実装したところ
>   （層・エンティティカードは面積が大きく）P2（accent面積8%上限）を実機テストで超過した
>   （layered_stack 3層構成でaccent面積比16.7%）。marimekko/treemap（S5a）と同じ
>   アウトライン枠線方式（`_add_outline_rect`。線はP2の計算対象外）に切り替えて解消した。
> - `make visual` の目視確認で2件のジオメトリ不具合を発見・修正した（invariantsのpytestは
>   通るが、shape座標自体は妥当なため機械テストでは検出できない類の不具合）。
>   (1) `er_diagram`/`state_transition` はいずれも当初「中心-中心」で接続線を引いていたが、
>   カードが隣接して並ぶ er_diagram では線のほぼ全体がカードの下に隠れ、カーディナリティ
>   ラベルも判読不能だった。矩形境界の交点同士を結ぶ `_rect_edge_point` ヘルパーを新設し、
>   両型に適用して解消した（あわせて er_diagram のカード間 gap も0.25"→0.45"に拡げ、線色も
>   `rule`→`muted`にして短い線分でも視認できるようにした）。
>   (2) `state_transition` の円周配置は、次数3以上のノード（分岐が複数ある状態）がある
>   トポロジーでは数学的に最低1本の交差線（chordが隣接ノードの上を通る）が避けられない
>   ことが判明した。examples の states 並び順を「頻出遷移が隣接するように書く」よう調整し
>   （3本→1本に削減）、この制約と対処法を dsl-reference.md に明記した。
>   円周配置＋直線接続という v1 の単純化に起因する既知の限界であり、任意グラフの
>   完全な自動レイアウトは本DSLの設計制約（座標を書かない・標準図形のみ）の範囲外として
>   対応しない。
> - `type_catalog.md` の陳腐化した重複📋（`api_endpoint_table` が115行目に📋・116行目に✅の
>   矛盾表記で残存）もあわせて是正した。
> - `RENDERERS` は124→134型（`examples/tech_diagrams_demo.slide` を新規追加し、経費精算SaaSの
>   技術資料を題材に10型を1枚ずつ実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4以降と同じ、型名を列挙しない非網羅文書）。

> **S5d 実施時の補足（2026-08-15）**:
> - 着手前の調査で、計画に書かれた「7型」のうち `chapter_number_strip`（章番号帯）が
>   既存 `chapter_band`（`render_base_band.py:39`）と、`haikei_kadai_kaiketsu_kouka`
>   （背景-課題-解決策-効果）が既存 `haikei`（`render_base_labeled.py:73-76`）と
>   完全に同一意味論であると判明した。type_catalog.md §4「日本の登壇・ビジネス文化」の
>   6つの📋のうち2つがこの重複で、S4/S5cで清掃した「実装済みなのに📋のまま残る陳腐化」と
>   同種と判断し、正味4型のみを実装した（計画自身が「型名列挙・件数は当初調査時点の
>   スナップショット」と明記しており、type_catalog.mdを正とする運用どおり）。
> - 4型を実装コストで分けた。(A) `houkoku_sodan_irai` は `labeled_blocks`
>   （`render_base_labeled.py`）の VARIANTS へ `haikei` と同型で4行追記のみ。
>   (B) `cta_recruit` は `hero_canvas`（`render_base_hero.py`）に新mode `"cta"` を追加
>   （`trio` が既に blocks を使う前例だったため自然に拡張できた）。`framed_canvas`
>   （式次第・賞状等の儀礼文書美学）はCTAの訴求力と噛み合わないため不採用と判断。
>   (C) `takeaways_emoji` は `render_more.py` に新規関数（`cards` のグリッド計算をそのまま
>   流用し、chip四角を絵文字テキストに置換）。`cards` はvariant機構を持たない直登録
>   スタイルのため、variant化ではなく新規関数として追加した。(D) `speaker_intro_card` は
>   `render_frameworks3.py` に新規関数（`persona_card` のOVAL写真+頭文字パターンを
>   単一フォーカス構成へ簡略化。`persona_card` の薄いラッパー化はジオメトリ・variant受け皿が
>   無く不適と判断し独立実装にした）。
> - `cta_recruit` の連絡先バーは、設計段階で「全幅×高さ0.75"」だと面積比8.95%となり
>   P2上限（8%）を超過すると事前計算で判明したため、実装前に幅をCONTENT_W×0.85・
>   高さ0.65"に調整した（面積比約6.6%）。S5cで発生後に気づいた反省を活かし、今回は
>   実装前に計算で確認してから着手した。
> - 絵文字（takeaways_emoji）の描画に技術的制約は無いことを確認した
>   （Yu Gothicにカラー絵文字グリフが無くてもOS/PowerPoint側のフォールバックで表示される。
>   本環境のNoto Color Emojiで`make visual`の目視確認も可能）。
> - `type_catalog.md` §4「日本の登壇・ビジネス文化」の重複2件（`chapter_number_strip`/
>   `haikei_kadai_kaiketsu_kouka`）をカタログから削除した。
> - `RENDERERS` は134→138型（`examples/presentation_culture_demo.slide` を新規追加し、
>   技術カンファレンス登壇を題材に4型を実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4以降と同じ、型名を列挙しない非網羅文書）。

> **S5e 実施時の補足（2026-08-15）**:
> - S5dの教訓（計画の型名が既存実装と重複していた事故）を踏まえ、着手前に
>   type_catalog.md §4「教育・学術」の8型とRENDERERSの重複・意味的重複を先に確認した。
>   今回は型名列挙が type_catalog.md と正確に一致し、重複も無かった（S5dのような
>   スコープ訂正は不要）。調査の副産物として、`nodes_and_connectors` の既存
>   `flow_branching` variant が名前に反し**実際には分岐を描画していない**（縦一列＋
>   DOWN_ARROWのみ）ことが判明した。type_catalog.mdはこのvariantを「PRISMA風」と
>   謳っていたが実体が伴っておらず、prisma_flow/consort_flowには新規ジオメトリが
>   必要と結論づけた（既存variant自体の修正はスコープ外として着手せず）。
> - 8型を4グループに分けた。(A) `worked_example`/`theorem_proof`/`imrad_overview` は
>   `labeled_blocks`（`render_base_labeled.py`）へVARIANTS追記のみ（prep/sdsと同じ
>   layout="col"パターンを踏襲。複数ステップは自動採番せずlinesの箇条書きで表現し、
>   既存の`process`型との差別化を保った）。(B) `flashcard` は `split_layout`
>   （`render_base_split.py`）へbefore_afterと同型で追記。(C) `prisma_flow`/
>   `consort_flow` は `nodes_and_connectors`（`render_base_nodes.py`）に新レイアウト
>   `"vertical_side"` を追加。段階ブロックの`rows`（他レイアウトでは未使用だった）を
>   除外理由のサイドボックス表示に転用し、パーサ変更なしで実現した。2型は
>   labels違いのみの完全同一実装とし、S5dの逆パターン（同一意味論を別実装してしまう
>   無駄）を避けた。(D) `frayer_model`/`abstract_slide` は新規 `render_education.py`
>   （`render_frameworks.py`/`render_data_support.py`にはテーマ的に収まらないため）。
>   `frayer_model` は `swot`（`render_frameworks.py`）と同じ固定2x2ジオメトリに、
>   対象語ボックスを中央へ最後に重ね描き（Frayerモデルの意匠を再現）。
> - 新規実装（グループC/D）は既存の `_node_box`/`_arrow`（ブロック矢印）のみで構成し、
>   回転や新規シェイプ技法は使わなかった（S5cで確立した「回転不使用」判断を踏襲）。
> - `RENDERERS` は138→146型（`examples/education_demo.slide` を新規追加し、8型を
>   1枚ずつ実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4以降と同じ、型名を列挙しない非網羅文書）。

> **S5f 実施時の補足（2026-08-15）**:
> - type_catalog.md §4「ストーリー・マーケ」5型＋「データ補助」2型＝計7型が plan の
>   「7型」と正確に一致し、S5dのような数の食い違いは無かった。着手前調査で
>   RENDERERSとの名前衝突・意味的重複も無いことを確認した。
> - 7型を実装コストで分けた。(A) `golden_circle`/`storybrand_sb7`/`pixar_story_spine`/
>   `jtbd_statement` は `labeled_blocks`（`render_base_labeled.py`）へVARIANTS追記のみ。
>   `golden_circle` の正式な同心円（Simon Sinek）は「回転・カスタムジオメトリ禁止」
>   原則下でテキスト配置が破綻しやすくコスト高のため、`haikei`と同じ縦積み（col）に
>   簡略化した（vpc簡略化＝S5b、frayer_model＝S5eと同種の判断）。`storybrand_sb7`
>   （7要素）は grid layout の cols を3ではなく4にした（3+3+1より4+3の方が最終行の
>   空白が少なく収まりが良いと判断）。`pixar_story_spine`（7ビート）は
>   narrative_curve（emotion_arc等の基底）がラベル供給機構を持たず本文欄も無いため
>   小改修が要ると判明し、代わりに新規コード0で済む labeled_blocks の layout="row"
>   （kishotenketsu等の物語系と同じ横一列）を採用した。(B) `aida_funnel` は
>   `nodes_and_connectors`（`render_base_nodes.py`）の既存 `funnel` レイアウトに固定
>   ラベルを載せるだけ（`pdca`が`cycle_loop`＋固定ラベルの前例と同型）。数値必須の
>   `funnel`・定性段の`funnel_steps`との紛らわしさはdsl-reference/type-selection-guide
>   に相互参照を明記（S5aの前例を踏襲）。(C) `before_after_metric` は
>   `render_data_support.py` に新規関数（`split_layout`の`_panel`が箇条書き表示
>   固定でvariant追記では大数字表示に対応できないと判明したため独自実装。
>   before_afterの2パネル＋中央矢印とstat_trioの大数字表示を組み合わせた）。
>   (D) `annotated_chart` は `render_charts_shapes.py` に新規関数。ネイティブChart API
>   （render_charts.py）にはpython-pptxがレンダリング後の描画位置を取得できないため
>   特定データ点への注釈コールアウトを正確配置する前例が無いと判明し、S5aと同じ
>   「自前で棒を矩形描画する」方針を踏襲した。値は`lines[0]`、注釈は`rows`の1つ目の
>   値（ラベル自由）から取得し、`_row_num`（ラベル付きrowsを値として読む既存ヘルパー）
>   とは競合しないよう値と注釈を別々の読み出し経路にした。
> - `RENDERERS` は146→153型（`examples/story_marketing_demo.slide` を新規追加し、
>   経費精算SaaSのマーケティングを題材に7型を実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4以降と同じ、型名を列挙しない非網羅文書）。

> **S5g 実施時の補足（2026-08-15）**:
> - type_catalog.md §4「個人・イベント・ライフ」の📋7型がplanの「7型」と正確に一致し、
>   S5dのような数の食い違いは無かった。着手前調査でRENDERERSとの名前衝突が無いことも
>   確認した。意味的重複の精査では、`event_timetable`が既存`program`（式次第。自動連番
>   のみで時刻なし）と近いが「時刻列」という差別化要素を持つため別型として妥当と判断し、
>   type-selection-guide.mdのprogram行に相互参照を明記した。`travel_itinerary`も
>   `journey_map`（観点レーン×ステージ）・`timeline`（1時点=1件）のどちらとも構造が
>   異なる（日ごとにグルーピングされた複数予定）ため独自型として実装した。
> - 7型を実装コストで分けた。(A) `smart_goal`/`elevator_pitch` は `labeled_blocks`
>   （`render_base_labeled.py`）へVARIANTS追記のみ。(B) `recipe_step` は
>   `split_layout`（`render_base_split.py`）へ非対称比率（材料0.4:手順0.6）で追記。
>   手順の自動番号は付けず本文に書く運用にした（既存`process`が番号バッジ担当のため
>   重複実装を避けた）。(C) `travel_itinerary`/`okr` は `columns_with_header`
>   （`render_base_columns.py`）へVARIANTS追記。`okr`は`lead`プロパティを
>   Objective帯（band="accent"）として転用し、`numbered=True`で各Key Resultに
>   自動採番させた（既存`numbered_columns`の実装をそのまま流用、新規コード無し）。
>   (D) `event_timetable`/`maturity_model` は新規 `render_life.py`。
>   `maturity_model`は「横方向N段階・右ほど成熟」という既存に無い構造のため新規実装した
>   （pyramid=縦積み幅変化、layered_stack=等幅縦積みのどちらとも別のジオメトリ）。
>   段の高さをpyramidの段階的width計算と同じ発想でグラデーションさせ、右ほど高い
>   「階段状」の見た目にした。
> - `maturity_model`のhighlight（現在地レベル等）は、段の面積が大きくaccent塗りだと
>   P2（8%上限）を超過しやすいと設計段階で判断し、layered_stack/er_diagram（S5c/S5e）
>   と同じアウトライン枠線方式を最初から採用した（実装後に気づいて修正するのではなく、
>   S5c/S5eの教訓を活かし事前に回避した）。
> - `RENDERERS` は153→160型（`examples/life_events_demo.slide` を新規追加し、
>   経費精算SaaSの導入・展開を題材に7型を実演）。
> - `docs/system_prompt.md` は変更不要と判断した（S4以降と同じ、型名を列挙しない非網羅文書）。
> - **S5系列（分野別バッチ）はS5gで一区切り**。ただし着手前調査で、type_catalog.md §4
>   「tsundoku知見由来の新規候補」（S3, 2026-08で発見）の6型
>   `pictogram_array`/`dot_matrix_chart`/`org_chart`/`ranking_list`/`faq_qa`/
>   `mission_vision_values` がどのS5バッチにも割り当てられておらず📋のまま残っている
>   ことが判明した。S5g完了をもって「型カタログの📋が完全に無くなった」わけではない点に
>   留意（この6型の実装要否・後続バッチ「S5h」の起案はユーザー判断に委ねる）。

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
