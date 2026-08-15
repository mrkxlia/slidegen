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

## 型カタログ（RENDERERS 全168型。用途で型名を選ぶ）
- title / section / agenda / quote / bullets … 表紙・章扉・目次・引用・箇条書き
- compare(2〜4) / cards(2〜6) / kpi(1〜4) / process(3〜6) / pros_cons(2) / table / persona_card
  / speaker_intro_card / takeaways_emoji(2〜6) / ranking_list(上限8)
    … 比較・カード・指標・手順・メリデメ・表・ペルソナカード・登壇者紹介・絵文字付き
      持ち帰りポイント・順位バッジ付きランキング（下記参照）
- matrix / cycle / pyramid / tree / org_chart(ノード10・レベル3上限) / formula / timeline / image_left
    … 対応表・循環・階層・樹形図・多段組織図・数式・年表・画像+文（org_chartはrowsで上司参照。下記参照）
- labeled_blocks(基底) / prep / sds / desc … 話法フレーム（Point-Reason-Example-Point 等）
- kishotenketsu / johakyu … 物語フレーム（起承転結・序破急）
- feia / haikei / houkoku_sodan_irai … 分析・提案（Finding-Action・背景-課題-解決・報告-相談-依頼）
- kpt / ssc / fourls … ふりかえり（Keep-Problem-Try・Stop-Start-Continue・4Ls）
- brand_pillars / sipoc / what_sowhat_nowwhat / mission_vision_values … フレームワーク解説
    （mission_vision_valuesはbrand_pillarsの3固定ロール版：Mission-Vision-Values）
- faq_qa … Q&A（col.title=質問、lines=回答。col縦積み）
- 4p / pestel … マーケティングミックス（Product-Price-Place-Promotion）・
    マクロ環境分析（Political-Economic-Social-Technological-Environmental-Legal）
- 5e / kwl … 教育フレーム（5E・KWL）
- worked_example / theorem_proof / imrad_overview … 問題-解法・定理-証明（col2つ固定）・
    論文構成（Introduction-Methods-Results-Discussion）
- smart_goal(5要素固定) / elevator_pitch … SMARTゴール（Specific-Measurable-Achievable-
    Relevant-Time-bound）・エレベーターピッチ（For-Who-Our Product-Unlikeの4ブロック）
- golden_circle / jtbd_statement … Why-How-What（同心円を縦積みに簡略化）・
    Job to be Done（When-I want to-So I can の3ブロック）
- storybrand_sb7(7要素固定) … StoryBrand（Character-Problem-Guide-Plan-CTA-Success-Failure）
- pixar_story_spine(7要素固定) … Pixarのストーリースパイン（時系列7ビート・横一列）
- split_layout(基底) / before_after / problem_solution / dual_hero / image_text … 左右分割：対比・課題解決・2要素並置・画像+文
- hypothesis_prediction / limitations_future / flashcard / recipe_step … 左右分割：
    仮説と予測・限界と展望・用語カード・レシピ（左=材料・右=手順）
- before_after_metric … Before/After の大数字2値比較（中央矢印。下記参照）
- grid_2d(基底) / comparison_matrix / scorecard_compare / raci / heatmap_matrix / decision_matrix / plain_grid
  / priority_matrix_2x2 / quiz_mcq / mandala_chart / sdg_grid / conjugation_table
  / slo_sli_table / incident_severity_table
    … 行×列のセル（評価記号◎○△×・スコア比較・責任分担・色濃淡評価・意思決定基準・単純グリッド・
      優先度2x2・4択クイズ・マンダラチャート・SDGs一覧・活用表・SLI一覧・インシデント重大度表。
      書き方は下記参照）
- nodes_and_connectors(基底) / process_flow / value_chain / cycle_loop / pdca / funnel_steps / aida_funnel
- flow_branching / cloud_architecture / prisma_flow / consort_flow
    … ノード+矢印（横並びフロー・バリューチェーン・循環・PDCA・定性ファネル・AIDA集客
      ファネル・分岐フロー・クラウド構成の左→右ティア・文献選定フロー・臨床試験フロー。
      数値必須の定量ファネルは `funnel` を使う。書き方は下記参照）
- hero_canvas(基底) / big_fact / stat_trio / tagline / takahashi / ted_idea / break_slide / statement / cta_recruit
    … 単一フォーカス（巨大数字1つ／3つの数字並置／一言コピー／高橋メソッド／TED型メッセージ／休憩幕間／宣言文／採用CTA。書き方は下記参照）
- columns_with_header(基底) / policy_3col / know_dontknow / editorial_cols / numbered_columns / data_limitations
  / travel_itinerary / okr
    … ヘッダー帯+N列（論点整理・分かっている/いないこと・編集コラム・番号付き列・データの限界注記・
      旅行日程表・OKR。leadがヘッダー帯の文言になる。書き方は下記参照）
- narrative_curve(基底) / emotion_arc / story_curve / trend_line / sparkline_narrative … 折れ線+注釈ピン（感情曲線・物語曲線・トレンド線・注釈付き推移）
- band_strip(基底) / section_band / sidebar / source_footer / chapter_band … 水平/垂直の帯（章扉・サイドバー・出典フッタ・章番号帯）
- framed_canvas(基底) / program / greeting / certificate / announcement … 外枠+内部（式次第・挨拶状・賞状・告知。
    式次第は連番のみ・時刻付きなら event_timetable を使う）
- bar_chart / line_chart / bar_horizontal / stacked_bar / stacked_100_bar / clustered_bar / area_chart
    … 添付Excel/CSVの数値をネイティブ編集可能グラフ化（下記の書き方を厳守）
- scatter / bubble
    … 2〜3変数の相関・分布をネイティブ散布図/バブルチャート化（categories を使わない。下記参照）
- waterfall / swot(4象限固定) / venn2(2円) / bmc(9ブロック固定) / lean_canvas(9ブロック固定)
  / frayer_model(4象限固定)
    … 増減の分解＋定番ビジネスフレーム＋用語学習の4象限（col の数・順序が意味を持つ。下記参照）
- vpc / five_forces / 3c / bcg_matrix(2x2固定) / empathy_map / tam_sam_som(3固定) … バリュー
    プロポジションキャンバス・ファイブフォース・3C分析・PPM（花形/問題児/金のなる木/負け犬の
    固定順。自由軸の4象限は matrix を使う）・共感マップ・市場規模の入れ子円（TAM→SAM→SOMの
    固定順。col の数・順序が固定。下記参照）
- bullet(上限4) … 目標vs実績のバレットグラフ（ゲージの代替。箇条書きの bullets とは別の型。下記参照）
- funnel(上限6) … 定量ファネル（段ごとに幅が減るバー。定性の段のみなら nodes_and_connectors 系の
    funnel_steps、AIDA固定ラベルなら aida_funnel を使う。下記参照）
- football_field(上限6) … 評価手法ごとのレンジを横バーで比較（M&Aのvaluation football field。下記参照）
- harvey_ball_table(行5×列5上限) … 定性比較を●◐○の4段階記号で表現（comparison_matrixと同じ書き方。下記参照）
- marimekko(列5×セグメント4上限) … 列幅=規模・縦は構成比100%積み上げのマリメッコチャート（下記参照）
- treemap(上限8) … 面積=構成比のツリーマップ（DSL記述順＝配置順。下記参照）
- sankey(左4×右4×フロー8上限) … 左右2段の簡易フロー図（下記参照）
- journey_map / pricing_tiers / roadmap(レーン4・バー各4上限) … カスタマージャーニー（stages必須。
    下記参照）・料金プラン比較（col highlight で推奨プラン強調）・ロードマップ（レーン×期間の
    スパンバー。単一レーンの時系列は timeline を使う。下記参照）
- value_chain … バリューチェーン（nodes_and_connectors 系。上記参照）
- code_block / terminal / api_endpoint_table / code_diff / sql_result
    … ソースコード・ターミナル出力・API仕様一覧・差分表示・クエリと結果テーブル
      （col の行がコード/コマンド行、または title=HTTPメソッド。下記参照）
- layered_stack / c4_context / sequence_diagram / state_transition / er_diagram
    … 技術資料の図解系（技術スタックの層・C4コンテキスト図・シーケンス図・状態遷移図・ER図。
      標準図形のみで構成しMermaidレンダリング画像は使わない。下記参照）
- data_source_footer … 出典付きの主張（headline+message+source。col は使わない。下記参照）
- abstract_slide … 論文アブストラクト（abstract本文＋keywordsチップ。col は使わない。下記参照）
- annotated_chart(上限8) … 自前描画の棒グラフ＋注釈コールアウト（ネイティブChartには
    注釈を付けられないため。下記参照）
- event_timetable(上限10) … イベントのタイムテーブル（時刻バッジ＋内容の行リスト。
    programとは時刻列の有無で使い分ける。下記参照）
- maturity_model(上限6) … 成熟度モデル（横方向N段階。右ほど成熟＝カードが階段状に
    高くなる。下記参照）
- dot_matrix_chart(上限25) / pictogram_array(上限25) … 単一の値を「N個中M個を塗った
    単位アイコン」で示す（円のドット／人型の代わりの角丸長方形。1つの値のみ・col複数は
    非対応。下記参照）

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

slide cta_recruit
  headline "一緒にプロダクトを作りませんか"
  contact "採用ページ: example.com/careers"   # 下部の強調バーに表示（任意）
  col                                          # 訴求ポイント（上限4、col.title=1行）
    "フルリモート可"
  col
    "エンジニア5名採用中"

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

## grid_2d 系：slo_sli_table / incident_severity_table（comparison_matrix と同じ書き方）

slo_sli_table（行=SLI名、列=目標・実績等。状態悪化などの強調は行ごと highlight）:
slide slo_sli_table
  headline "主要SLIの状況"
  columns "SLO目標" "直近実績" "エラーバジェット残" "状態"
  col "API可用性" highlight
    "99.9%" "99.95%" "62%" "◎"
  col "レイテンシP95"
    "200ms以下" "180ms" "80%" "○"

incident_severity_table（行=SEV1〜4等、列=定義・初動SLA等。SEV1などを highlight で強調）:
slide incident_severity_table
  headline "インシデント重大度の定義"
  columns "定義" "初動SLA" "エスカレーション"
  col "SEV1" highlight
    "全ユーザー影響のサービス停止" "15分以内" "即時・役員報告"
  col "SEV2"
    "一部機能の重大な障害" "30分以内" "オンコール担当"

## code_diff の書き方（行頭 +/- で追加・削除を色分け。code_block と同じ col 構造）

slide code_diff
  headline "タイムアウト設定を追加"
  lang "diff — retry.py"
  col
    "     def fetch(url):"      # 先頭が +/- 以外＝文脈行
    "-        return requests.get(url)"       # 削除行（先頭 -）
    "+        return requests.get(url, timeout=5)"  # 追加行（先頭 +）

## sql_result の書き方（query は複数値propで複数行のクエリ。col=結果テーブルの列）

slide sql_result
  headline "アクティブユーザー数トップ5"
  query "SELECT user_id, count(*) AS cnt" "FROM events" "GROUP BY user_id"  # 複数値=複数行
  col "user_id"        # col.title = 結果テーブルの列名。lines = その列の値（上から順に行）
    "1001"
    "1002"
  col "cnt"
    "42"
    "7"

## cloud_architecture の書き方（nodes_and_connectors 系。process_flow と同じ書き方）

col ×2〜6（左→右のティア。ブロック矢印で連結）:
slide cloud_architecture
  headline "配信基盤のアーキテクチャ"
  col "クライアント"
    "ブラウザ / モバイルアプリ"
  col "CDN/Edge"
    "Cloudflare"
  col "データ" highlight
    "D1 / R2"

## layered_stack の書き方（col 記述順＝上から積む層。上限6層）

slide layered_stack
  headline "システムのレイヤー構成"
  col "プレゼンテーション層" highlight
    "React / Next.js"
  col "アプリケーション層"
    "Node.js API"
  col "データ層"
    "PostgreSQL"

## c4_context の書き方（1つ目の col=中心システム（常に強調）、以降=周辺アクター。上限6）

slide c4_context
  headline "受注システムのコンテキスト"
  col "受注システム"           # 1つ目 = 中心（常にaccent。highlight不要）
    "注文の受付と状態管理を担う"
  col "利用者"
    "Webブラウザから発注"
  col "決済代行"
    "Stripe API 経由で課金"

## sequence_diagram / state_transition / er_diagram の共通規約
## （from/to の rows を持つ col ＝ 接続を表すブロック）

この3型は「Mermaid流用」とカタログに注記があるが、実際にMermaidでレンダリングして画像を
貼ることはしない（画像化は絶対禁止のため）。標準図形（矩形・直線・テキスト）のみで組む。

3型に共通する記法：ブロック内に `from "名前"` / `to "名前"` の行（rows）を書くと、
そのcolは「接続（メッセージ/遷移/リレーション）」として扱われる。自己接続（from=to）は
現状非対応（描画されない）。

### sequence_diagram の書き方（participants=参加者。上限5。col記述順=時系列）

slide sequence_diagram
  headline "ログイン処理のシーケンス"
  participants "ユーザー" "API" "DB"    # 縦のライフラインになる（順に左から配置）
  col
    from "ユーザー"
    to "API"
    "ログイン要求"                       # メッセージ文（lines[0]）
  col highlight
    from "API"
    to "DB"
    "認証情報を照会"

### state_transition の書き方（states=状態。上限6。円周上に自動配置）

slide state_transition
  headline "注文ステータスの状態遷移"
  states "受付" "処理中" "発送済" "完了" "キャンセル"
  col
    from "受付"
    to "処理中"
    "決済確認"                           # 遷移ラベル（lines[0]）
  col highlight
    from "処理中"
    to "キャンセル"
    "取消"

states の並び順の注意：分岐が2つ以上ある状態（3つ以上の遷移を持つ状態）が存在すると、
円周配置では線が他の状態の近くを通ることがある（任意グラフの交差回避は行わない v1の
単純化）。**頻出する遷移が隣り合うように states を書く**と交差が減る（例: 分岐元の状態と
その主な行き先を states 上で隣接させる）。

### er_diagram の書き方（from/to を持たない col=エンティティ、持つ col=リレーション）

slide er_diagram
  headline "受注管理のER図"
  col "顧客"                # エンティティ（col.title=名前、lines=属性一覧。上限8）
    "{PK} customer_id"      # PK/FK等の強調は本文中の { } を使う
    "name"
  col "注文"
    "{PK} order_id"
    "{FK} customer_id"
  col                       # リレーション（from/toを持つ。上限10）
    from "顧客"
    to "注文"
    "1" "N"                 # 左右のカーディナリティ（lines[0]/lines[1]。省略可）

## takeaways_emoji の書き方（col.title=絵文字、col.lines=短い持ち帰り文。上限6）

slide takeaways_emoji
  headline "今日の持ち帰りポイント"
  col "🎯"
    "まず計測してから最適化する"
  col "🚀" highlight
    "小さくデプロイして学習を早める"

## speaker_intro_card の書き方（name/role プロパティ＋col1つ=bio箇条書き）

登壇者紹介1枚に特化した単一フォーカス構成（persona_card のような複数カード群は持たない）。

slide speaker_intro_card
  headline "登壇者紹介"
  name "山田 太郎"
  role "株式会社Example / シニアエンジニア"
  col
    "Webフロントエンド開発に10年従事"
    "OSSコントリビューター"

## frayer_model の書き方（col 4つ固定順：定義→特徴→具体例→非例。termで中央に対象語）

slide frayer_model
  headline "光合成の理解"
  term "光合成"          # 中央に重ね描きする対象語（省略可）
  col
    "光エネルギーを化学エネルギーに変換する生物の反応"
  col
    "葉緑体で起こる／CO2とH2Oを使う／酸素を放出する"
  col
    "植物の光合成／藻類の光合成"
  col
    "呼吸（酸素を使ってエネルギーを取り出す逆の反応）"

## abstract_slide の書き方（abstractは1段落・keywordsは複数値prop。col は使わない）

slide abstract_slide
  headline "深層学習を用いた不良品検出の高精度化"
  abstract "本研究では、製造ラインの画像から不良品を検出する深層学習モデルを提案する。"
  keywords "深層学習" "画像認識" "品質管理"

## prisma_flow / consort_flow の書き方（col記述順=縦フロー。rowsが除外/脱落のサイドボックスになる）

段階ごとに `lines`＝主本文（件数等）、`rows`＝除外・脱落理由（複数行可。ラベルは自由）。
rows が無い段階はサイドボックスを描かない。上限4段階（labels固定・タイトル不要）。

slide prisma_flow
  headline "文献の選定フロー"
  col
    "n = 1,200"
    理由 "重複 n=300"      # rows → 右にサイドボックスとして表示
  col
    "n = 900"
    理由 "対象外テーマ n=400"
  col highlight
    "n = 500"

consort_flow も同じ実装・ラベル違いのみ（組入れ→割付→追跡→解析）。書き方は同一：

slide consort_flow
  headline "被験者フロー"
  col
    "n = 300"
  col
    "n = 280"
    理由 "適格基準を満たさず n=20"

## golden_circle / storybrand_sb7 / pixar_story_spine / jtbd_statement（col の数と順序が固定）

golden_circle は col を3つ（Why→How→Whatの順。正式な同心円ではなく縦積みで表現）、
storybrand_sb7 は7つ（Character→Problem→Guide→Plan→CTA→Success→Failureの順。4列グリッド）、
pixar_story_spine は7つ（時系列の物語ビート順・横一列）、jtbd_statement は3つ
（When→I want to→So I canの順）で書く。順序を守ればcolにタイトルは不要。

slide storybrand_sb7
  headline "プロダクトのStoryBrand"
  col
    "経理担当者"
  col
    "レシート照合に月40時間かかる"

slide pixar_story_spine
  headline "プロダクトが生まれるまで"
  col
    "とある経理担当者がいた"
  col
    "毎月レシートの山と格闘していた"

## annotated_chart の書き方（col=カテゴリ、lines[0]=値、rowsの1つ目の値が注釈になる）

slide annotated_chart
  headline "月次アクティブユーザー数の推移"
  unit "万人"
  col "1月"       # col.title = カテゴリ
    "8"            # lines[0] = 値（棒の高さ）
  col "2月" highlight
    "12"
    理由 "キャンペーン終了で急落"    # rows → 棒の上に引き出し線付きコールアウト

## before_after_metric の書き方（col.title=大きな数値、lines[0]=キャプション）

slide before_after_metric
  headline "処理時間を劇的に短縮"
  col "5分"
    "手動での確認作業"
  col "30秒" highlight
    "自動化後の処理時間"

## event_timetable の書き方（col.title=時刻、lines=内容）

slide event_timetable
  headline "セミナー タイムテーブル"
  col "10:00"
    "開会の挨拶"
  col "10:15" highlight
    "基調講演"

## maturity_model の書き方（col記述順=左から右。右ほど成熟してカードが高くなる。上限6）

slide maturity_model
  headline "データ活用の成熟度モデル"
  col "Level 1｜属人的"
    "Excelで個別集計"
  col "Level 3｜標準化" highlight
    "共通ダッシュボード"
  col "Level 5｜最適化"
    "AIによる自動判断"

## columns_with_header 系：travel_itinerary / okr（lead がヘッダー帯の文言になる）

travel_itinerary は col.title=Day見出し（Day 1等）、lines=その日の予定一覧。
okr は lead に "Objective: ..." を書き、col=Key Result（title=KR文、lines=測定基準・
進捗などの補足）。numbered=Trueのため各KRに自動で01/02…の番号が振られる。

slide travel_itinerary
  headline "出張日程"
  lead "大阪・福岡の2社を訪問する2泊3日の出張"
  col "Day 1"
    "新幹線で大阪へ移動"
    "A社にて導入事例インタビュー"

slide okr
  headline "経理部門のOKR"
  lead "Objective: 経費精算業務の負荷を半減する"
  col "月次精算時間を40時間→10時間に短縮"
    "達成率70%（現在28時間）"

## smart_goal / elevator_pitch / recipe_step（col の数と順序が固定）

smart_goal は col を5つ（S→M→A→R→Tの順。5列row）、elevator_pitch は4つ
（For→Who→Our Product→Unlikeの順。縦積み）、recipe_step は2つ
（材料→手順の順。左右分割・手順の番号は本文に書く）で書く。順序を守ればcolに
タイトルは不要（recipe_stepの手順は自動番号なし）。

## org_chart の書き方（col.title=名前。rows[0]の値=上司の名前。上限ノード10・レベル3）

上司参照が無い（またはcol.titleに一致しない）ノードはルート扱いになる。DSL記述順は
問わない（先に子を書いてもよい）。循環参照はレベル計算時に打ち切って安全に描画する。

slide org_chart
  headline "開発本部の組織図"
  col "CEO"
  col "CTO"
    上司 "CEO"          # rows[0]の値=上司名（ラベルは自由）
  col "エンジニアリング部長"
    上司 "CTO"

## dot_matrix_chart / pictogram_array の書き方（col1つ・title=ラベル、lines[0]=値）

`total`（既定20・上限25にクランプ）個の単位アイコンのうち、値の数だけ塗る。
実物のISOTYPE図解も可読性のため通常10〜20個程度に留めるため、100個等では描かない。

slide dot_matrix_chart
  headline "顧客満足度"
  total "20"
  col "満足（4点以上）" highlight
    "14"

slide pictogram_array
  headline "経理担当者の10人に7人が回答"
  col "撮るだけで精算したいと回答"
    "7"

## ranking_list の書き方（col記述順=順位。バッジは自動採番。col.title=項目名、lines[0]=値）

slide ranking_list
  headline "満足度ランキング"
  col "ExpenseFlow" highlight
    "4.8"
  col "競合A"
    "4.2"

## faq_qa の書き方（col.title=質問、lines=回答。縦積み）

slide faq_qa
  headline "導入前のFAQ"
  col "既存の会計システムと連携できますか"
    "主要な会計システムとAPI連携できます"

## mission_vision_values の書き方（col 3つ固定順：Mission→Vision→Values）

slide mission_vision_values
  headline "私たちのMission / Vision / Values"
  col
    "経理業務から単純作業をなくす"
  col
    "誰もが本質的な仕事に集中できる世界"
  col
    "現場目線／シンプルさ／誠実さ"

## tam_sam_som の書き方（col 3つ固定順：TAM→SAM→SOM。title=ラベル、lines[0]=金額・規模）

下端揃えの入れ子円3つで市場規模を示す。2ブロックなら2重円になる。

slide tam_sam_som
  kicker "市場規模"
  headline "経費精算SaaSの市場規模の見立て"
  col "TAM｜経費精算市場全体"
    "1.2兆円"
  col "SAM｜中堅企業向けSaaS"
    "3,000億円"
  col "SOM｜獲得可能シェア"
    "150億円"

## roadmap の書き方（periods=列見出し、rows の期間指定がスパンバーになる）

col=レーン（上限4）、rows=(期間指定, 施策名)（レーンごと上限4）。期間指定は "Q2" の
単一指定か "Q1-Q3" の範囲指定（開始-終了。periods 内の名前を参照）。periods に無い
期間名のバーは警告してスキップされる。periods を省略すると rows の期間指定から出現順に
導出される。col highlight でそのレーンのバーが accent になる。

slide roadmap
  kicker "事業計画"
  headline "2026年度プロダクトロードマップ"
  periods "Q1" "Q2" "Q3" "Q4"
  col "プロダクト"
    Q1-Q2 "OCR精度改善"
    Q3-Q4 "API公開"
  col "セールス" highlight
    Q2 "パートナー開拓"
