# slidegen DSL リファレンス

## 絶対ルール
- 1スライド1メッセージ。headline は主張（言い切り）。
- 強調は1スライド原則1箇所。手段は2つだけ：本文中の {語句}、col の highlight。
- インデントは半角スペース2つ。値は必ず "..." で囲む。複数スライドは単独行 --- で区切る。
- 座標・色・フォント・サイズは絶対に書かない。

## 記法の基本形（大半の型に共通）
座標・色・フォントは書かない。ほとんどの型は下記の骨格だけで書ける
（型名を変えるだけでラベル・配置・強調色・要素数上限が自動で決まる）。

slide <型名>
  kicker "小見出し（任意）"
  headline "主張（言い切り）"
  foot "脚注（任意）"
  col "見出し（型によっては省略可）" highlight   # highlight は強調したい1個だけに付ける
    "本文/値 1行目"
    "本文/値 2行目（型によっては複数行）"
  col "見出し2"
    "本文/値"

型ごとの差は「col にタイトルが要るか」「col の行数」「用途」だけ。下記カタログの
用途を見て型名を選び、中身（headline/col の文言）だけを書けばよい。

## 型カタログ（RENDERERS 全100型。用途で型名を選ぶ）
- title / section / agenda / quote / bullets … 表紙・章扉・目次・引用・箇条書き
- compare(2〜4) / cards(2〜6) / kpi(1〜4) / process(3〜6) / pros_cons(2) / table … 比較・カード・指標・手順・メリデメ・表
- matrix / cycle / pyramid / tree / formula / timeline / image_left … 対応表・循環・階層・樹形図・数式・年表・画像+文
- labeled_blocks(基底) / prep / sds / desc … 話法フレーム（Point-Reason-Example-Point 等）
- kishotenketsu / johakyu … 物語フレーム（起承転結・序破急）
- feia / haikei … 分析・提案（Finding-Action・背景-課題-解決）
- kpt / ssc / fourls … ふりかえり（Keep-Problem-Try・Stop-Start-Continue・4Ls）
- brand_pillars / sipoc / what_sowhat_nowwhat … フレームワーク解説
- 5e / kwl … 教育フレーム（5E・KWL）
- split_layout(基底) / before_after / problem_solution / dual_hero / image_text … 左右分割：対比・課題解決・2要素並置・画像+文
- hypothesis_prediction / limitations_future … 左右分割：仮説と予測・限界と展望
- grid_2d(基底) / comparison_matrix / scorecard_compare / raci / heatmap_matrix / decision_matrix / plain_grid
    … 行×列のセル（評価記号◎○△×・スコア比較・責任分担・色濃淡評価・意思決定基準・単純グリッド。書き方は下記参照）
- nodes_and_connectors(基底) / process_flow / value_chain / cycle_loop / pdca / flow_branching / funnel_steps
    … ノード+矢印（横並びフロー・バリューチェーン・循環・PDCA・分岐フロー・ファネル）
- hero_canvas(基底) / big_fact / stat_trio / tagline / takahashi / ted_idea / break_slide / statement
    … 単一フォーカス（巨大数字1つ／3つの数字並置／一言コピー／高橋メソッド／TED型メッセージ／休憩幕間／宣言文。書き方は下記参照）
- columns_with_header(基底) / policy_3col / know_dontknow / editorial_cols / numbered_columns / data_limitations
    … ヘッダー帯+N列（論点整理・分かっている/いないこと・編集コラム・番号付き列・データの限界注記）
- narrative_curve(基底) / emotion_arc / story_curve / trend_line / sparkline_narrative … 折れ線+注釈ピン（感情曲線・物語曲線・トレンド線・注釈付き推移）
- band_strip(基底) / section_band / sidebar / source_footer / chapter_band … 水平/垂直の帯（章扉・サイドバー・出典フッタ・章番号帯）
- framed_canvas(基底) / program / greeting / certificate / announcement … 外枠+内部（式次第・挨拶状・賞状・告知）
- bar_chart / line_chart / bar_horizontal / stacked_bar / stacked_100_bar / clustered_bar
    … 添付Excel/CSVの数値をネイティブ編集可能グラフ化（下記の書き方を厳守）
- waterfall / swot(4象限固定) / venn2(2円) / bmc(9ブロック固定)
    … 増減の分解＋定番ビジネスフレーム（col の数・順序が意味を持つ。下記参照）
- journey_map / pricing_tiers … カスタマージャーニー（stages必須。下記参照）・料金プラン比較（col highlight で推奨プラン強調）
- value_chain … バリューチェーン（nodes_and_connectors 系。上記参照）
- code_block / terminal / api_endpoint_table
    … ソースコード・ターミナル出力・API仕様一覧（col の行がコード/コマンド行、または title=HTTPメソッド。下記参照）
- data_source_footer … 出典付きの主張（headline+message+source。col は使わない。下記参照）

## hero_canvas 系の書き方（big_fact 等は col ではなく専用プロパティ）
slide big_fact
  number "3.2x"
  caption "導入後3ヶ月の処理速度"
  foot "※当社調べ N=42"

slide stat_trio
  col "98%"
    "顧客継続率"
  col "1.5億"
    "累計取引額"

slide tagline
  headline "一言で伝えたいコピー"

## table の書き方（先頭の col が見出し行になる）
slide table
  headline "主要3製品の早見表"
  col "項目"          # 1つ目の col = ヘッダー行（列見出し）
    "SalesBoost"
    "A社"
  col "月額"
    "2,580円"
    "3,980円"

## data_source_footer の書き方（col を使わない）
slide data_source_footer
  kicker "市場規模"
  headline "国内SaaS市場は年率18%で拡大している"
  message "本文。{強調したい語句}は波括弧で1箇所だけ。"
  source "出典名"
  period "対象期間（例: 2020〜2025）"
  n "サンプルサイズ（無ければ — ）"
  note "補足（任意）"

## journey_map の書き方（stages が必須）
slide journey_map
  headline "導入から定着までのジャーニー"
  stages "認知" "検討" "導入" "活用"   # ステージ（列）
  col "行動"                          # レーン（行）。行数=stages数
    "広告で知る" "他社と比較" "契約" "日次で利用"
  col "感情"
    "半信半疑" "不安と期待" "設定が大変" "効果を実感"

## code_block / terminal の書き方（col の行がそのままコード/コマンド行）
slide code_block
  headline "リトライ処理の実装"
  lang "python — retry.py"
  col
    "def fetch_with_retry(url, n=3):"
    "    for i in range(n):"        # 行頭スペースはそのまま保持される（インデント表現）

## swot / venn2 / bmc（col の数と順序が固定）
swot は col を4つ（強み・弱み・機会・脅威の順）、venn2 は3つ（左円・重なり・右円の順）、
bmc は9つ（9ブロックの固定順）で書く。順序を守れば col にタイトルは不要。

## チャート型の書き方（重要・厳守）
チャートは専用の型名そのものを slide の型に使う（"chart_type" というプロパティは存在しない）。
カテゴリ（横軸ラベル）は top-level の categories に並べ、系列は col の直下に「数値だけの行」を置く。

slide bar_chart
  kicker "..."
  headline "..."
  categories "Q1" "Q2" "Q3" "Q4"      # 横軸ラベル（カテゴリ）
  unit "百万円"                          # 任意：軸の単位
  col "売上"                             # col.title = 系列名
    "120"                               # 各行は数値のみ（カテゴリ順）
    "150"
    "135"
    "180"

# 型の選び方:
#   - 単一系列の量 → bar_chart（横棒なら bar_horizontal）
#   - 複数系列の量比較 → clustered_bar
#   - 時系列の推移 → line_chart
#   - 積み上げ → stacked_bar、構成比(100%) → stacked_100_bar
# 複数系列は col を複数並べる（各 col が1系列。行数=カテゴリ数）。

## grid_2d 系（comparison_matrix 等）
slide comparison_matrix
  headline "..."
  columns "列1" "列2" "列3"
  col "行名"
    "セル値"
    "セル値"
    "セル値"
