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

## 型カタログ（RENDERERS 全124型。用途で型名を選ぶ）
- title / section / agenda / quote / bullets … 表紙・章扉・目次・引用・箇条書き
- compare(2〜4) / cards(2〜6) / kpi(1〜4) / process(3〜6) / pros_cons(2) / table / persona_card … 比較・カード・指標・手順・メリデメ・表・ペルソナカード（下記参照）
- matrix / cycle / pyramid / tree / formula / timeline / image_left … 対応表・循環・階層・樹形図・数式・年表・画像+文
- labeled_blocks(基底) / prep / sds / desc … 話法フレーム（Point-Reason-Example-Point 等）
- kishotenketsu / johakyu … 物語フレーム（起承転結・序破急）
- feia / haikei … 分析・提案（Finding-Action・背景-課題-解決）
- kpt / ssc / fourls … ふりかえり（Keep-Problem-Try・Stop-Start-Continue・4Ls）
- brand_pillars / sipoc / what_sowhat_nowwhat … フレームワーク解説
- 4p / pestel … マーケティングミックス（Product-Price-Place-Promotion）・
    マクロ環境分析（Political-Economic-Social-Technological-Environmental-Legal）
- 5e / kwl … 教育フレーム（5E・KWL）
- split_layout(基底) / before_after / problem_solution / dual_hero / image_text … 左右分割：対比・課題解決・2要素並置・画像+文
- hypothesis_prediction / limitations_future … 左右分割：仮説と予測・限界と展望
- grid_2d(基底) / comparison_matrix / scorecard_compare / raci / heatmap_matrix / decision_matrix / plain_grid
  / priority_matrix_2x2 / quiz_mcq / mandala_chart / sdg_grid / conjugation_table
    … 行×列のセル（評価記号◎○△×・スコア比較・責任分担・色濃淡評価・意思決定基準・単純グリッド・
      優先度2x2・4択クイズ・マンダラチャート・SDGs一覧・活用表。書き方は下記参照）
- nodes_and_connectors(基底) / process_flow / value_chain / cycle_loop / pdca / flow_branching / funnel_steps
    … ノード+矢印（横並びフロー・バリューチェーン・循環・PDCA・分岐フロー・ファネル）
- hero_canvas(基底) / big_fact / stat_trio / tagline / takahashi / ted_idea / break_slide / statement
    … 単一フォーカス（巨大数字1つ／3つの数字並置／一言コピー／高橋メソッド／TED型メッセージ／休憩幕間／宣言文。書き方は下記参照）
- columns_with_header(基底) / policy_3col / know_dontknow / editorial_cols / numbered_columns / data_limitations
    … ヘッダー帯+N列（論点整理・分かっている/いないこと・編集コラム・番号付き列・データの限界注記）
- narrative_curve(基底) / emotion_arc / story_curve / trend_line / sparkline_narrative … 折れ線+注釈ピン（感情曲線・物語曲線・トレンド線・注釈付き推移）
- band_strip(基底) / section_band / sidebar / source_footer / chapter_band … 水平/垂直の帯（章扉・サイドバー・出典フッタ・章番号帯）
- framed_canvas(基底) / program / greeting / certificate / announcement … 外枠+内部（式次第・挨拶状・賞状・告知）
- bar_chart / line_chart / bar_horizontal / stacked_bar / stacked_100_bar / clustered_bar / area_chart
    … 添付Excel/CSVの数値をネイティブ編集可能グラフ化（下記の書き方を厳守）
- scatter / bubble
    … 2〜3変数の相関・分布をネイティブ散布図/バブルチャート化（categories を使わない。下記参照）
- waterfall / swot(4象限固定) / venn2(2円) / bmc(9ブロック固定) / lean_canvas(9ブロック固定)
    … 増減の分解＋定番ビジネスフレーム（col の数・順序が意味を持つ。下記参照）
- vpc / five_forces / 3c / bcg_matrix(2x2固定) / empathy_map … バリュープロポジションキャンバス・
    ファイブフォース・3C分析・PPM（花形/問題児/金のなる木/負け犬の固定順。自由軸の4象限は matrix
    を使う）・共感マップ（col の数・順序が固定。下記参照）
- bullet(上限4) … 目標vs実績のバレットグラフ（ゲージの代替。箇条書きの bullets とは別の型。下記参照）
- funnel(上限6) … 定量ファネル（段ごとに幅が減るバー。定性の段のみなら nodes_and_connectors 系の
    funnel_steps を使う。下記参照）
- football_field(上限6) … 評価手法ごとのレンジを横バーで比較（M&Aのvaluation football field。下記参照）
- harvey_ball_table(行5×列5上限) … 定性比較を●◐○の4段階記号で表現（comparison_matrixと同じ書き方。下記参照）
- marimekko(列5×セグメント4上限) … 列幅=規模・縦は構成比100%積み上げのマリメッコチャート（下記参照）
- treemap(上限8) … 面積=構成比のツリーマップ（DSL記述順＝配置順。下記参照）
- sankey(左4×右4×フロー8上限) … 左右2段の簡易フロー図（下記参照）
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

## swot / venn2 / bmc / lean_canvas（col の数と順序が固定）
swot は col を4つ（強み・弱み・機会・脅威の順）、venn2 は3つ（左円・重なり・右円の順）、
bmc は9つ（9ブロックの固定順）、lean_canvas も9つ（bmc と同じ非対称レイアウトで、
Problem/Solution/Key Metrics/UVP/Unfair Advantage/Channels/Customer Segments/Cost/Revenue の順）
で書く。順序を守れば col にタイトルは不要。

## vpc の書き方（col 6つ固定順。左=Value Map／右=Customer Profile の3段対応）
col は「左上→左中→左下→右上→右中→右下」の順（Gain Creators→Products & Services→
Pain Relievers→Gains→Customer Jobs→Pains）。col にタイトルは不要。

slide vpc
  headline "提供価値と顧客課題のフィット"
  col
    "承認まで自動で回る"
  col
    "レシートOCRアプリ"
  col
    "手入力と照合をなくす"
  col
    "月次を早く締めたい"
  col
    "毎月の経費精算・承認"
  col
    "手作業の転記ミス"

## five_forces の書き方（col 5つ固定順。中央→上→左→右→下）
col は「中央(業界内の競争)→上(新規参入の脅威)→左(売り手の交渉力)→右(買い手の交渉力)→
下(代替品の脅威)」の順。col にタイトルは不要。

slide five_forces
  headline "業界構造の5つの競争要因"
  col
    "大手2社と多数の新興"
  col
    "開発障壁は低い"

## 3c の書き方（col 3つ固定順。顧客を頂点にした三角配置）
col は「顧客→自社→競合」の順（型名は数字始まりだが `slide 3c` とそのまま書ける）。
col にタイトルは不要。

slide 3c
  headline "市場・競合・自社の3C"
  col
    "市場は年率12%成長"
  col
    "OCR精度に強み"
  col
    "大手は大企業向け中心"

## bcg_matrix の書き方（col 4つ固定順。自由軸の4象限は matrix を使う）
col は「花形→問題児→金のなる木→負け犬」の固定順（軸ラベル・象限色も固定）。
自由に軸ラベルを決めたい2x2は `matrix` 型（props の x_axis/y_axis）を使う。

slide bcg_matrix
  headline "投資は花形と問題児に集中する"
  col
    "クラウド経費精算"
  col
    "AI監査オプション"
  col
    "会計事務所向け既存製品"
  col
    "オンプレ版"

## empathy_map の書き方（col 6つ固定順。上段2x2＋下段Pain/Gain）
col は「考え・感情→見えているもの→聞いていること→発言・行動→Pain→Gain」の順。
col にタイトルは不要。

slide empathy_map
  headline "顧客の共感マップ"
  col
    "また月末が来る"
  col
    "山積みのレシート"
  col
    "早く締めてほしいの声"
  col
    "手作業で照合し続ける"
  col
    "残業と入力ミス"
  col
    "定時で締めて分析に時間を使う"

## persona_card の書き方（name/role プロパティ＋col。1つ目のcolだけ rows 可）
name/role はトップレベルのプロパティ。1つ目の col（タイトル省略可）は「ラベル "値"」形式の
属性一覧（プロフィール）、2つ目以降の col はタイトル必須（ゴール／課題等の見出しになる）で
本文は箇条書き。highlight で強調したいセクションに付ける。

slide persona_card
  headline "ターゲット：中堅メーカーの経理マネージャー"
  name "田中 花子"
  role "経理マネージャー（38）・従業員300名の製造業"
  col "プロフィール"
    経験 "経理歴12年"
    環境 "会計ソフト＋Excel"
  col "ゴール"
    "月次決算を5営業日で締める"
  col "課題" highlight
    "紙のレシート照合に月40時間"

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
#   - 時系列の累積・面で示す → area_chart（col を複数並べると積み上げ面）
# 複数系列は col を複数並べる（各 col が1系列。行数=カテゴリ数）。

## scatter / bubble の書き方（x,y座標の点群。categories を使わない）
categories の代わりに、col の各行を1点として直接 x,y の値で書く。ラベル付き多値行
（`ラベル "x" "y"`）は使えない（ラベル指定時は2値目以降が捨てられる仕様のため）。

slide scatter
  headline "広告費と売上の相関"
  x_label "広告費（百万円）"      # 任意：軸ラベルの注記
  y_label "売上（億円）"
  col "既存店"                   # col = 系列（複数可）
    "10" "1.2"                  # 1行 = "x" "y" の2値（ラベル無し）
    "15" "1.8"
  col "新店"
    "8" "0.9"

slide bubble                    # 同じ書き方。1行 = "x" "y" "規模" の3値
  headline "市場の魅力度マップ"
  x_label "市場成長率（%）"
  y_label "シェア（%）"
  col "事業ポートフォリオ"
    "12" "30" "45"
    "5" "55" "80"

## bullet の書き方（目標vs実績。ゲージの代替）
col 1つ=KPI 1個（上限4）。行の1行目=実績、2行目=目標、3行目(任意)=上限
（省略時は実績・目標の1.15倍が自動設定される）。ラベル（実績/目標/上限）は表示用の
自由文字列で、意味を決めるのは行の並び順（何行目か）。

slide bullet
  headline "主要KPIの達成状況"
  unit "％"
  col "売上達成率" highlight   # highlight = 実績バーを強調（1つだけ）
    実績 "82"
    目標 "100"
    上限 "120"                # 任意。省略可
  col "新規顧客数"
    実績 "340"
    目標 "300"

## funnel の書き方（定量ファネル。定性の段のみなら funnel_steps を使う）
col 1つ=段1個（上限6）。1行目=値（数値）。

slide funnel
  headline "登録までのファネル"
  unit "人"
  col "訪問"
    "10000"
  col "登録" highlight
    "1200"

## football_field の書き方（評価レンジの横バー比較）
col 1つ=評価手法1個（上限6）。1行に2値「下限」「上限」を書く。任意で marker に
基準値（現在値等）を書くと縦線が入る。

slide football_field
  headline "株式価値の評価レンジ"
  unit "億円"
  marker "100"               # 任意：基準値の縦線
  col "DCF"
    "80" "120"
  col "類似会社比較" highlight
    "90" "140"

## harvey_ball_table の書き方（定性比較 ●◐○。comparison_matrix と同じ書き方）
値は 0/25/50/75/100 のみ（最近傍にスナップされる）。行5×列5が上限。

slide harvey_ball_table
  headline "3社の定性比較"
  columns "機能" "価格" "サポート"    # 評価軸（列。短い語で）
  col "自社" highlight               # highlight で行全体を強調
    "100" "75" "100"
  col "A社"
    "50" "100" "25"

## marimekko の書き方（列幅=規模、縦=構成比100%）
col=列（上限5）、col 直下の各行は「セグメント名 "値"」（上限4行、全列で同じ順に書く）。
セグメントの色は行の並び順で決まる（1行目=main、2行目=main_2、…）。

slide marimekko
  headline "地域×製品の売上構成"
  unit "億円"
  col "国内" highlight       # highlight は列名・合計の文字色と枠線のみを強調（塗りは変えない）
    製品A "60"
    製品B "40"
  col "北米"
    製品A "30"
    製品B "50"

## treemap の書き方（面積=構成比。DSL記述順のまま配置する＝並べ替えない）
col=項目（上限8）。1行目=値。大きい順に書くと見やすい。

slide treemap
  headline "事業別売上の構成"
  unit "億円"
  col "クラウド" highlight    # highlight は枠線のみで強調（セル文字は背景とのコントラスト優先で変えない）
    "45"
  col "受託開発"
    "30"

## sankey の書き方（左右2段の簡易フロー図）
col=左ノード（上限4）。col 直下の各行「右ノード名 "値"」= そのノードから右ノードへの
フロー（右ノードは出現順に自動集約、上限4。フロー総数は上限8で超過分は切り捨てられる）。

slide sankey
  headline "流入チャネル別の転換フロー"
  unit "件"
  col "広告経由" highlight   # highlight でそのノードと流出フローを強調
    無料登録 "60"
    直接購入 "15"
  col "オーガニック"
    無料登録 "40"

## grid_2d 系（comparison_matrix 等）
slide comparison_matrix
  headline "..."
  columns "列1" "列2" "列3"
  col "行名"
    "セル値"
    "セル値"
    "セル値"

## grid_2d 系：priority_matrix_2x2 / quiz_mcq / mandala_chart / sdg_grid / conjugation_table

conjugation_table（行=人称、列=時制。comparison_matrix と同じ書き方）:
slide conjugation_table
  headline "be動詞の人称・時制変化"
  columns "現在形" "過去形" "未来形"
  col "I"
    "am"
    "was"
    "will be"
  col "He / She / It" highlight
    "is"
    "was"
    "will be"

quiz_mcq（col 1つ=選択肢1つ。正解は highlight で指定。columns には短い見出しを1つ）:
slide quiz_mcq
  headline "日本で人口が最も多い都道府県は？"
  columns "回答"
  col "A"
    "大阪府"
  col "B" highlight
    "東京都"
  col "C"
    "愛知県"

priority_matrix_2x2（2x2固定。列=横軸、col=縦軸。強調したい象限のセルだけ本文中の { } で囲む）:
slide priority_matrix_2x2
  headline "重要度×緊急度で優先順位を可視化"
  columns "緊急" "緊急でない"
  col "重要"
    "{重大インシデント対応}、顧客からの緊急問い合わせ"
    "中期戦略の立案、スキルアップ学習"
  col "重要でない"
    "急な差し込み会議、定型の事務連絡"
    "SNSチェック、雑務"

mandala_chart（3x3固定。col はタイトルなしで3つ、各3行。中央=2つ目のcolの2つ目の行）:
slide mandala_chart
  headline "マンダラチャート：新規事業立ち上げ"
  col
    "資金調達"
    "市場調査"
    "チーム編成"
  col
    "法務対応"
    "{新規事業立ち上げ}"
    "プロダクト設計"
  col
    "販路開拓"
    "ブランディング"
    "KPI設計"

sdg_grid（17目標を任意の行数に手分割。列数が揃わなくてもよい）:
slide sdg_grid
  headline "自社事業がひもづくSDGs目標"
  col
    "1 貧困をなくそう"
    "2 飢餓をゼロに"
    "3 保健"
  col
    "7 エネルギー"
    "{9 産業と技術革新}"
    "10 不平等の是正"

mandala_chart / sdg_grid の注意：この2型は row_label が無いため `col ... highlight` は
描画に反映されない（無視される）。強調は必ず本文中の `{ }` を使う。
また sdg_grid は公式の17色を使わない（本DSLの配色制約は常に自社テーマ内の色で統一する）。
