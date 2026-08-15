# slidegen 開発の経緯（history）

> 本ファイルはプロジェクトの**過去の経緯を集約する唯一のドキュメント**。
> README・CLAUDE.md・requirements.md・spec.md・backlog.md 等の現行ドキュメントは
> 「現在の姿」だけを記述し、経緯・完了記録はすべてここに置く。
> ここに載っているのは要約であり、全文（削除済みファイル・旧構成のコード）は
> git 履歴および Git タグ `archive/cloudflare-webapp` から参照できる。

## 年表（概略）

| 時期 | 出来事 |
|---|---|
| 2026-05 | 構想開始。DSL→編集可能 pptx の3層責任分界を設計（ppt_design_doc.md）。初期実装は純Python・18型 |
| 2026-06〜07 | Cloudflare 無料枠の「AI と壁打ちしてスライドを作る Web アプリ」（frontend/gateway）を併設する2階建て構成で運用。立て直しエンゲージメントで要件/仕様/ADR/テストを整備 |
| 2026-08-13 | Web アプリを撤去し Agent Skills / プラグイン構成へ転換（S1）。スキル＋両対応プラグイン化・リポジトリ public 化（S2）。tsundoku 知識抽出（S3） |
| 2026-08-14〜15 | 型カタログの未実装型を分野別バッチで実装完走（S4〜S5h＋外部記事由来2型）。RENDERERS は 100→168型 |
| 2026-08-15 | 経緯記述を本ファイルへ集約し、現行ドキュメントを現在形に再編。Web アプリ期の ADR 4本を削除、存続 ADR を 0001〜0003 に改番 |

## Web アプリ期（2026-05〜2026-08）

かつて slidegen は「DSL→編集可能 pptx の純Python ライブラリ」＋「Cloudflare 無料枠で動く
壁打ち Web アプリ」の2階建て構成だった。Web アプリは React+Vite の `frontend/` と
Hono 製 LLM 中継ゲートウェイ `gateway/` から成り、Cloudflare Pages で稼働していた。

当時の主要な設計判断（削除済み旧 ADR の要約）:

- **旧 ADR 0001: ゲートウェイを Pages Functions として同一オリジン配信**（2026-06-27）—
  独立 Worker のクロスオリジン構成では Cloudflare Access の Cookie 認証が成立しないため、
  Hono アプリを同じ Pages プロジェクトの Functions として配信し `/api/*` を同一オリジン化した。
- **旧 ADR 0003: pptx 生成をブラウザ内 Pyodide で実行**（2026-06-28）— Workers 無料枠の
  CPU 制約と C 拡張（lxml/Pillow）非対応のため、slidegen を wheel 化して micropip で
  ブラウザに導入し、ユーザー端末の WASM CPython でレンダした。純Python・ホスト非依存という
  ライブラリ設計はこの可搬性要件に由来する。
- **旧 ADR 0005: マルチプロバイダ LLM 抽象＋SSE 専用＋2層フォールバック**（2026-06-28）—
  無料 LLM 枠の不安定さに対し、プロバイダ横断抽象（SSRF 不変条件つき）と
  transport 層/意味層の2層フォールバックで壁打ちの継続性を確保した。

この時期の立て直しエンゲージメント（2026-07）で、requirements.md / spec.md の新設、
ADR の整備、テスト3層化などの基盤づくりを行った（詳細は後述「backlog 完了記録」）。

## Web アプリ撤去と Agent Skills 転換の決定（旧 ADR 0007、2026-08-13）

**決定**: Cloudflare Web アプリ（`frontend/` `gateway/` と紐づく CI/CD）を完全に削除し、
純Python ライブラリ＋ Agent Skills / プラグイン構成へ転換する。

**理由**:

- LLM プロバイダのモデルカタログ追随、Cloudflare 無料枠の制約（CPU 時間・Access 認証）に
  合わせた設計など、本体ライブラリのスコープ外の保守面積を継続的に生んでいた。
- 2026-08 に **Agent Skills オープン仕様**（agentskills.io）と **Agent Plugins 1.0**
  （agent-plugins.org、OpenAI/AWS/Cursor/GitHub/VS Code/Vercel 策定）が登場し、
  「AI と壁打ちしてスライドを作る」体験は自前 Web UI なしで各エージェントの対話機能で
  代替可能になった。壁打ちフロー・DSL リファレンスは LLM に渡すプロンプト資産であり、
  エージェント共通のスキルとして配布する方が自然。

**実施内容と注意**:

- プロンプト資産（DSL リファレンス・壁打ちフェーズプロンプト・pptx 取り込みプロンプト）は
  `skills/slidegen/references/` へ逐語移設。「教える型 ≡ RENDERERS」の CI ガードは
  `dsl-reference.md` を読むよう付け替えた（テスト目的は不変）。
- CI は `uv build` + `pytest` 中心に縮小（Node/wheel/deploy ステップを削除）。
- **移設コミット時点**（Web アプリ・旧 CI・旧テストが無傷で新配置と共存する唯一の時点）に
  Git タグ `archive/cloudflare-webapp` を付与。Web アプリの復元はこのタグからの
  再チェックアウト＋ Cloudflare 側リソース（Pages プロジェクト・Access・secrets）の
  再セットアップで可能。
- 検討した代替案: 併存（2系統維持のコスト過大で却下）、アーカイブブランチ退避
  （誤マージ・履歴混入リスクで却下、タグを採用）、リポジトリ分割（存続させる価値なしで却下）。

## 転換の実施記録（S1〜S3、2026-08-13）

実行計画は旧 `docs/plans/2026-08-agent-skills-transition.md`（削除済み、git 履歴参照）。
1セッション=1PR を目安に、各ステップでユーザー承認を取りながら進めた。

- **S1: Cloudflare 撤去＋DSL リファレンス移設** — `frontend/` `gateway/`・Node 系ツール・
  Web 前提テスト・deploy CI を削除。`frontend/src/prompts.ts` の DSL リファレンス全文を
  `skills/slidegen/references/dsl-reference.md` へ、対話フローを `phase-prompts.md`（後に
  役目を終えて削除）、`IMPORT_DECK_SYSTEM` を `import-deck-prompt.md` へ移設。
  リポジトリ外リソースの後片付け（Pages プロジェクト削除・GitHub secrets 削除）も実施
  （Zero Trust Access アプリの削除と API キー失効はユーザー作業として backlog に残存）。
- **S2: Agent Skill＋両対応プラグイン化（PR #27）** — `SKILL.md`（オープン仕様6フィールド限定）・
  `scripts/slidegen.sh`・ルート `plugin.json`（Agent Plugins 1.0）・`.claude-plugin/`
  （Claude Code）・LICENSE(MIT) を追加し、`tests/test_plugin_manifests.py` で整合を機械保証。
  `claude plugin validate` は CI に入れず `make validate-skill` のローカル運用に固定
  （Node を CI に戻さない縮小方針の維持。skills-ref は commit SHA ピン留め）。
  **SKILL.md には型名を列挙しない**運用ルールを採用（型カタログの正本を dsl-reference.md
  一本に保つ）。gitleaks＋直撃パターンで履歴のシークレット監査を実施し（真の秘密 0 件）、
  履歴を書き換えずに**リポジトリを public 化**した。
- **S3: tsundoku 知識抽出（PR #28）** — 記事クリップ Vault
  [tsundoku](https://github.com/mrkxlia/tsundoku) のスライド関連ノート5本（デザインパターン39選・
  グラフテンプレ36枚・コンサル流構成術ほか）から `references/design-guidelines.md`
  （デザイン原則）と `references/type-selection-guide.md`（型の逆引き）を編纂し、
  SKILL.md から参照。新規型候補7型をカタログに追加した。

## 型カタログの実装完走（S4〜S5h＋外部記事由来2型、2026-08-14〜15）

型カタログ（type_catalog.md）の未実装型（🔜5型＋📋約50型）を分野別バッチで実装し、
RENDERERS を 100型 → 168型 に拡充してカタログの📋をゼロにした。各バッチとも
「dsl-reference.md 追記（CI 強制）・examples 追加・スナップショット更新・カタログ✅化」を
完了条件とし、1バッチ=1PR で実施した。

| バッチ | 分野・型 | RENDERERS | PR |
|---|---|---|---|
| S4 | grid_2d variant 5型（priority_matrix_2x2 / quiz_mcq / mandala_chart / sdg_grid / conjugation_table） | 100→105 | #29 |
| S5a | チャート系10型（area_chart / scatter / bubble はネイティブ Chart、bullet / funnel / football_field / harvey_ball_table / marimekko / treemap / sankey は図形描画＝新規 render_charts_shapes.py） | 105→115 | #30 |
| S5b | ビジネスフレーム9型（lean_canvas / vpc / five_forces / 3c / 4p / pestel / bcg_matrix / empathy_map / persona_card。新規 render_frameworks3.py） | 115→124 | #31 |
| S5c | 技術資料10型（code_diff / sql_result / slo_sli_table / incident_severity_table / cloud_architecture / layered_stack / c4_context / sequence_diagram / state_transition / er_diagram。新規 render_tech_diagrams.py） | 124→134 | #33 |
| S5d | 日本の登壇文化 正味4型（speaker_intro_card / cta_recruit / takeaways_emoji / houkoku_sodan_irai。計画7型中2型は既存実装と重複判明） | 134→138 | #32 |
| S5e | 教育・学術8型（frayer_model / worked_example / theorem_proof / flashcard / imrad_overview / abstract_slide / prisma_flow / consort_flow。新規 render_education.py） | 138→146 | #34 |
| S5f | ストーリー・マーケ＋データ補助7型（golden_circle / storybrand_sb7 / pixar_story_spine / aida_funnel / jtbd_statement / annotated_chart / before_after_metric） | 146→153 | #35 |
| S5g | 個人・イベント・ライフ7型（elevator_pitch / event_timetable / okr / maturity_model / recipe_step / travel_itinerary / smart_goal。新規 render_life.py） | 153→160 | #36 |
| S5h | tsundoku 新規候補6型（pictogram_array / dot_matrix_chart / org_chart / ranking_list / faq_qa / mission_vision_values） | 160→166 | #37 |
| 単発 | 外部記事（パワポ研の IR 実例解説）との照合で見つかったギャップ2型（tam_sam_som / roadmap） | 166→168 | #38 |

バッチ横断で確立した主な設計判断（現行実装に生きているもの。詳細な経緯は各 PR 参照）:

- **図形描画チャートは標準プリセット図形の積み木**（回転・flip・カスタムジオメトリ不使用）。
  カタログで「Mermaid 流用」と注記されていた3型（sequence_diagram 等）も Mermaid 画像化ではなく
  標準図形合成で実装（画像化禁止原則と衝突するため。ユーザー確認済み）。
- **面積の大きい要素の highlight はアウトライン枠線方式**（accent 塗りは面積8%上限の
  インバリアント P2 に抵触しやすい。marimekko / treemap / layered_stack / er_diagram /
  maturity_model 等で採用）。
- **正式意匠の簡略化**は型ごとにユーザー承認・実装制約で判断（vpc の square+circle→2パネル、
  golden_circle の同心円→縦積み、3c のベン図→三角配置カード等）。
- **pictogram_array / dot_matrix_chart はユニット数を既定20・上限25にクランプ**
  （100個描くと1スライド shape 数上限 S2 に単独で抵触するため。単一値専用の設計で
  構造的に回避）。
- カタログの陳腐化（実装済みなのに📋のまま等）はバッチ着手時に都度是正した。

## backlog 完了記録の要約

方針転換以前〜転換中に backlog で管理し完了・Closed とした課題:

- **DSL 解説と実装のドリフト検知（PR #14 ほか）** — 「教える型 ⊆/≡ RENDERERS」の CI ガードを
  整備（現 test_dsl_reference.py / test_docs_drift.py / test_plugin_manifests.py の原型）。
- **全型ビジュアル回帰の自動化** — 図形ツリースナップショット方式（test_visual_regression.py、
  golden は Git 管理・LibreOffice 不要）を導入。目視のみだった見た目回帰を機械化。
- **potx 本連携** — `theme_from_potx()` を追加し、template 指定時に potx テーマ色を自動抽出。
- **テキストはみ出しの物理検出** — インバリアント S3 として第1層テストに追加。
- **DSL 静的バリデーション** — `slidegen/dsl_validator.py`（未知型を build 前に検出）。
- **軽微負債（PR #14 / #17）** — Makefile の uv 統一、build-system コメント等。
- **Web アプリ前提の課題は撤去により Closed** — モデルカタログ陳腐化、e2e/ビュー層テスト、
  wheel 名の分散管理、サムネイル生成、IndexedDB 永続化、マルチモーダル添付解析など。

## 削除・改番した文書の対応表（2026-08-15 のドキュメント再編）

経緯集約にあたり「当初から Agent Skills 構成だった」形に現行ドキュメントを再構成した。

**ADR の改番**（内容は不変、番号とファイル名のみ変更）:

| 旧 | 新 |
|---|---|
| 0002-uv-for-python-packaging.md | 0001-uv-for-python-packaging.md |
| 0004-editable-native-pptx.md | 0002-editable-native-pptx.md |
| 0006-provenance-roundtrip.md | 0003-provenance-roundtrip.md |

**削除**（全文は git 履歴で参照可能。要約は本ファイル上記）:

- `docs/adr/0001-same-origin-pages-functions.md`（Web アプリ期の判断）
- `docs/adr/0003-browser-pyodide-rendering.md`（同上）
- `docs/adr/0005-multi-provider-sse-fallback.md`（同上）
- `docs/adr/0007-retire-webapp-agent-skills.md`（撤去の決定。本ファイルに吸収）
- `docs/plans/2026-08-agent-skills-transition.md`（完走済み実行計画。本ファイルに吸収）
- `skills/slidegen/references/phase-prompts.md`（旧 Web アプリの壁打ちフェーズプロンプトの
  出自保存用残置。要点は SKILL.md 本文に編み込み済みで役目を終えた）
