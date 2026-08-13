# slidegen 型選択ガイド（内容から型を選ぶ）

> 位置づけ: 型の書き方（記法）は必ず [dsl-reference.md](dsl-reference.md) を見る（正本はそちら）。
> 本ファイルは「何を表現したいか」から型名を逆引きするための索引で、記法の詳細（フィールド名等）は
> 書かない。分類の考え方は [design-guidelines.md](design-guidelines.md) §2 を参照。
>
> 表記規則: 実装済み型（`RENDERERS` 登録済み）はバッククォートで書く。未実装の候補は 📋 マーク付きで
> 書き、バッククォートは使わない（実装済みと明確に区別するため）。

## 分類A: 要素間に関係がある（対立・比較・並列・階層・循環など）

| したいこと | 型名 | 備考 |
|---|---|---|
| 2〜4案を横並びで比較する | `compare` | |
| 現状とTo-Beを左右で対比する | `before_after` | |
| 課題と解決策を左右で示す | `problem_solution` | |
| 2要素を対等に並べる | `dual_hero` | |
| 仮説と予測を左右で示す | `hypothesis_prediction` | |
| 限界と次に向けた展望を左右で示す | `limitations_future` | |
| 4象限で分類・位置づけを示す | `matrix` | |
| SWOT分析（4象限固定） | `swot` | |
| 意思決定基準で評価する | `decision_matrix` | |
| 評価を◎○△×で比較する | `comparison_matrix` | |
| スコアで比較する | `scorecard_compare` | |
| 評価を色の濃淡で示す | `heatmap_matrix` | |
| 責任分担（RACI）を示す | `raci` | |
| 単純な行×列のグリッドを作る | `plain_grid` | |
| 2集合の重なりを示す（ベン図） | `venn2` | |
| 親子・階層構造を1段示す | `tree` | 多段の組織図は📋org_chart（新規候補）参照 |
| 数式・算出方法を示す | `formula` | 相乗効果（掛け算）・組み合わせ（足し算）もこの型で表現できる |
| 手順・ロードマップを横並びフローで示す | `process` / `process_flow` | |
| バリューチェーンを示す | `value_chain` | |
| 循環・PDCAを示す | `cycle` / `cycle_loop` / `pdca` | |
| 分岐フローを示す | `flow_branching` | |
| じょうろ型（下位ほど絞り込まれる）の分解を示す | `funnel_steps` | |
| ピラミッド型（上位ほど規模が小さい）の階層を示す | `pyramid` | |
| ビジネスモデルキャンバス（9ブロック固定） | `bmc` | |
| カスタマージャーニーを示す | `journey_map` | |

## 分類B: 要素間に関係がない（グラフ・事例・型が決まっているもの）

| したいこと | 型名 | 備考 |
|---|---|---|
| 指標(KPI)を1〜4個並べて示す | `kpi` | |
| 単一系列の量を比較する | `bar_chart` / `bar_horizontal` | 項目の順位を見せるなら横棒 |
| 複数系列を比較する | `clustered_bar` | |
| 時系列の推移を示す | `line_chart` | |
| 積み上げで内訳を示す | `stacked_bar` | 主役は1系列に絞る（design-guidelines.md §4） |
| 構成比の推移を示す | `stacked_100_bar` | |
| 累積の面グラフで示す | 📋 area_chart（新規候補） | 当面は `line_chart` で代替 |
| 割合を人型ピクトグラムで示す | 📋 pictogram_array（新規候補） | |
| 割合をドットの集合で示す | 📋 dot_matrix_chart（新規候補） | |
| 増減の要因分解を示す（ウォーターフォール） | `waterfall` | |
| 目標に対する達成度を示す（ゲージの代替） | 📋 bullet（既存📋候補） | |
| 定性評価を●◐○等で示す | 📋 harvey_ball_table（既存📋候補） | |
| 円グラフで割合を示したい | — | design-guidelines.md §4 の理由により非推奨。`stacked_100_bar` か `bar_horizontal` で代替 |
| 料金プランを比較する | `pricing_tiers` | |
| 年表・沿革・スケジュールを示す | `timeline` | |
| ランキング・順位を示す | 📋 ranking_list（新規候補） | 当面は `table` / `bar_horizontal` で代替 |
| 名言・問いかけを大きく示す | `quote` | |
| 事例・特徴・メンバーを並べる（カード） | `cards` | |
| メリット・デメリットを示す | `pros_cons` | |
| Q&Aをまとめる | 📋 faq_qa（新規候補） | 当面は `labeled_blocks` / `prep` で代替 |
| ソースコードを示す | `code_block` | |
| ターミナル出力を示す | `terminal` | |
| API仕様一覧を示す | `api_endpoint_table` | |
| 出典付きの主張を1枚で示す | `data_source_footer` | |
| データの限界・注記を示す | `data_limitations` | |
| 表で情報を整理する | `table` | |
| 画像1枚とテキストを左右に置く | `image_left` / `image_text` | |

## 分類C: ページ項目があらかじめ決まっている（定型ページ）

| したいこと | 型名 | 備考 |
|---|---|---|
| 表紙を作る | `title` | |
| 章の切り替え・扉ページを示す | `section` / `section_band` / `chapter_band` | |
| 目次・アジェンダを示す | `agenda` | |
| 箇条書きでテキストのみ示す | `bullets` | |
| 巨大な数字1つを主役にする | `big_fact` | |
| 3つの数字を並べる | `stat_trio` | 導入実績の「数値押し出し」型としても使える |
| 一言コピーを大きく示す | `tagline` | |
| 宣言文・ステートメントを示す | `statement` | |
| 休憩・幕間ページを示す | `break_slide` | |
| 高橋メソッド（大きな文字1〜数語）で示す | `takahashi` | |
| TED型の1メッセージスライドを示す | `ted_idea` | |
| MVV（Mission/Vision/Values）を示す | 📋 mission_vision_values（新規候補） | 当面は `brand_pillars` / `tagline` で代替 |
| 論点を3列で整理する | `policy_3col` | |
| フレームワークの柱を示す（ブランドピラー等） | `brand_pillars` | |
| 式次第・進行表を示す | `program` | |
| 挨拶状・お礼状を示す | `greeting` | |
| 賞状・認定証を示す | `certificate` | |
| 告知・お知らせを示す | `announcement` | |
| 組織図（多段階層）を示す | 📋 org_chart（新規候補） | 1段のみなら `tree` で代替可 |
| 出典・脚注のフッタ帯を示す | `source_footer` | |
| サイドバー・補足帯を示す | `sidebar` | |

## 使わない方がよい表現

- 円グラフ・ゲージ・3D → 理由は design-guidelines.md §4 参照。`stacked_100_bar` / `bar_horizontal` /
  📋bullet（新規候補ではなく既存📋候補）で代替する。
- 画像キャプチャの羅列・地図での拠点表示・実績ロゴの壁 → ネイティブ図形のみ・画像化しないという
  設計思想（`docs/type_catalog.md` §6）と衝突しやすいため現状非対応。詳細は
  `docs/type_catalog.md` §4「tsundoku 知見由来の新規候補」の❌候補を参照。

## その他: 話法・ふりかえり・教育フレーム系

`prep` / `sds` / `desc`（話法フレーム）、`kishotenketsu` / `johakyu`（物語フレーム）、
`feia` / `haikei`（分析・提案）、`kpt` / `ssc` / `fourls`（ふりかえり）、`sipoc` /
`what_sowhat_nowwhat`（フレームワーク解説）、`5e` / `kwl`（教育フレーム）、`know_dontknow` /
`editorial_cols` / `numbered_columns`（コラム系）、`emotion_arc` / `story_curve` / `trend_line` /
`sparkline_narrative`（折れ線+注釈系）は、型名自体が用途を表しているため本ガイドの逆引き表からは省略する。
一覧は dsl-reference.md の型カタログを参照。
