# slidegen 型カタログ 決定版

3系統の調査（①コンサル/チャート系 ②SpeakerDeck/SlideShare系 ③全方位）で発掘した型を、
重複を排除して1つに統合したカタログ。型を追加・整理する際の見取り図として使う。

**最重要の結論**：個別型を量産するより、**9つの基底レイアウト**を実装し、その上に
「variant（ラベル・配置・強調位置の辞書）」を載せる方式（3軸分解：基底 × variant × 中身）が
圧倒的に効率的。9基底で約170型を吸収できる。

---

## 0. ステータス凡例

- ✅ 実装済み（動作確認済み）
- ❌ 不採用（設計思想と不整合／画像必須／情報過密）

---

## 1. 基底レイアウト（9種）— ここが実装の核

| 基底 | 状態 | 吸収する型数 | 何を吸収するか |
|---|---|---|---|
| `labeled_blocks` | ✅ | 約35 | ラベル付きブロックの集合。縦積み/横並び/グリッド配置。PREP/KPT/起承転結/フレームワーク系 |
| `split_layout` | ✅ | 約25 | 左右/上下のフルブリード分割(比率可変)。image_left/before_after/対比系 |
| `grid_2d` | ✅ | 約25 | 行×列のセル群。comparison_matrix/raci/heatmap。評価記号・RAGをセル色に自動変換 |
| `nodes_and_connectors` | ✅ | 約20 | ノード+矢印。process/cycle/sequence/PRISMA/フロー図(linear/circular/branching) |
| `hero_canvas` | ✅ | 約15 | 単一フォーカス(中央/隅/分割)。big_fact/表紙/休憩/TED型 |
| `columns_with_header` | ✅ | 約20 | ヘッダー帯+N列。教育/行政/データ補助 |
| `narrative_curve` | ✅ | 約8 | 折れ線+注釈ピン。感情曲線/sparkline/anomaly |
| `band_strip` | ✅ | 約10 | 水平/垂直の帯。section/sidebar/出典フッタ |
| `framed_canvas` | ✅ | 約10 | 外枠+内部。賞状/式次第/挨拶状 |

基底9種はすべて実装済み ✅（labeled_blocks / split_layout / grid_2d / nodes_and_connectors / hero_canvas / columns_with_header / narrative_curve / band_strip / framed_canvas）。
個別型（チャート系など）はこの基底の上に追加していく。

---

## 2. 実装済みの型（`RENDERERS` に計168型）

> **真実は `slidegen/render.py` の `RENDERERS`**（`uv run python -c "import slidegen,slidegen.render as r;print(len(r.RENDERERS))"`
> → 168）。本書は分類のための見取り図。
> 数の手入力は古くなりやすいので、網羅確認は `RENDERERS` を参照すること。

### ベース構成（既存）
✅ title / section / agenda / quote / bullets

### 内容パターン（既存）
✅ compare / cards / kpi / process / pros_cons / table

### 関係図（既存）
✅ matrix / cycle / pyramid / tree / formula / timeline / image_left

### 基底 labeled_blocks + variant（話法・ふりかえり・フレームワーク）
✅ labeled_blocks（基底本体）
✅ prep / sds / desc（話法フレーム）
✅ kishotenketsu / johakyu（物語フレーム）
✅ feia / haikei（分析・提案）
✅ kpt / ssc / fourls（ふりかえり）
✅ brand_pillars / sipoc / what_sowhat_nowwhat（フレームワーク）
✅ 5e / kwl（教育）

---

## 3. 基底 split_layout / grid_2d の variant

### split_layout 系
| 型 | 状態 | 用途 | variant/設定 |
|---|---|---|---|
| before_after | ✅ | 現状とTo-Be対比 | left=現状, right=To-Be, 中央矢印 |
| problem_solution | ✅ | 課題赤×解決青 | ratio=50/50, 色分け |
| dual_hero | ✅ | 2要素同等並置 | ratio=50/50 |
| image_text | ✅ | 画像左+テキスト右 | ratio=40/60（既存image_leftを統合） |
| hypothesis_prediction | ✅ | 仮説と予測 | left=H, right=予測 |
| limitations_future | ✅ | 限界と次研究 | left=限界, right=Future |

### grid_2d 系
| 型 | 状態 | 用途 | variant/設定 |
|---|---|---|---|
| comparison_matrix | ✅ | 技術選定◎○△× | 行=選択肢, 列=評価軸, 記号セル |
| heatmap_matrix | ✅ | 評価の色濃淡 | セル={value,color} |
| raci | ✅ | 責任分担表 | R/A/C/I色付き |
| priority_matrix_2x2 | ✅ | Eisenhower等 | preset=eisenhower/impact_effort |
| quiz_mcq | ✅ | 4択クイズ | 問題+A-D+Answer |
| mandala_chart | ✅ | マンダラート3×3 | 中央+周囲8 |
| sdg_grid | ✅ | SDGs17マス | 公式色不使用・自社テーマ内で統一, highlightは{ }で表現 |
| conjugation_table | ✅ | 活用表 | 行=人称, 列=時制 |

---

## 4. 個別型（分野別）

### チャート系（①調査）— 基底とは別に専用実装が要るもの
✅ 基本チャート6種(bar_chart/bar_horizontal/line_chart/stacked_bar/stacked_100_bar/clustered_bar)
   → python-pptx のネイティブChart APIで実装。
✅ waterfall（増減分解）
✅ bullet（ゲージ代替。目標vs実績）
✅ harvey_ball_table（定性比較●◐○。OVALのリング＋PIEの部分塗りで4段階を表現）
✅ funnel / scatter / bubble / marimekko / sankey / treemap / football_field
❌ 円グラフ・ゲージ・3D（設計思想で非推奨。stacked_100_bar/bulletで代替）

### ビジネスフレーム（①③調査）
✅ swot / ✅ venn2 / ✅ bmc（9ブロック固定）／ ✅ lean_canvas（9ブロック固定）
✅ value_chain ／ ✅ five_forces / 3c / 4p / pestel / bcg_matrix
✅ journey_map（スイムレーン）／ ✅ empathy_map / persona_card

### 技術資料（②調査）
✅ code_block / ✅ terminal / ✅ api_endpoint_table ／ ✅ code_diff / sql_result
✅ sequence_diagram / state_transition / er_diagram（Mermaidレンダリングではなく標準図形合成で実装）
✅ layered_stack / cloud_architecture / c4_context
✅ slo_sli_table / incident_severity_table

### 日本の登壇・ビジネス文化（②③調査）
✅ speaker_intro_card / cta_recruit（登壇サンドイッチの冒頭・締め）
✅ takahashi（高橋メソッド）／ ✅ takeaways_emoji
✅ policy_3col ／ ✅ houkoku_sodan_irai
（章番号帯は chapter_band が、背景-課題-解決策-効果は haikei が同一意味論を担う）

### 教育・学術（③調査）
✅ frayer_model / worked_example / theorem_proof / flashcard
✅ imrad_overview / abstract_slide / prisma_flow / consort_flow

### ストーリー・マーケ（③調査）
✅ golden_circle / storybrand_sb7 / pixar_story_spine
✅ aida_funnel / jtbd_statement ／ ✅ brand_pillars / pricing_tiers

### データ補助（③調査）
✅ data_source_footer
✅ big_fact / ✅ stat_trio ／ ✅ annotated_chart / before_after_metric

### 個人・イベント・ライフ（③調査）
✅ pricing_tiers ／ ✅ elevator_pitch / event_timetable / okr / maturity_model
✅ recipe_step / travel_itinerary / smart_goal

### tsundoku 知見由来（③調査に追加）

tsundoku library の資料作成ノウハウ記事5本（詳細出典は
[design-guidelines.md](../skills/slidegen/references/design-guidelines.md) 末尾の出典表を参照）由来。
39パターンのうち並列/比較/マトリクス/ベン図/ツリー/数式/フロー/サイクル/
ピラミッド/ビフォーアフター等は、既存の matrix/venn2/tree/formula/process/cycle/pyramid/before_after
等の型が対応する（詳細な対応表は
[type-selection-guide.md](../skills/slidegen/references/type-selection-guide.md) を参照）。

✅ area_chart（累積面グラフ。line_chart系ネイティブチャート）
✅ pictogram_array / dot_matrix_chart（単一値のユニットグリッド。100個描くとインバリアント
  S2のshape数上限<80に抵触するため、既定20・上限25個にクランプした自前描画の共通実装
  （render_charts_shapes.py））
✅ org_chart（多段階層の組織図。rowsの値を上司参照とし、treeの1段限定を拡張する形で
  render_relations.pyに実装。ノード10・レベル3上限）
✅ ranking_list（render_more.pyに実装。順位バッジは自動採番）
✅ faq_qa / mission_vision_values（labeled_blocks variant）

❌ キャプチャ画像の羅列・拠点の地図表示・導入実績のロゴ壁
   （画像依存が強く「ネイティブ図形のみ・画像化しない」設計思想＝§6 と不整合の可能性が高い）

円グラフ(C1-C5)を採用しない判断（「❌ 円グラフ・ゲージ・3D」）は、グラフテンプレ36枚の
実例分析（Cleveland & McGillの読み取り精度知見）によっても裏付けられる。詳細は design-guidelines.md
§4 に引用済み。

### 外部記事由来（パワポ研）

パワポ研の記事「【徹底解説】パワポの図形機能を使ったスライド例と編集方法」
（note.com/powerpoint_jp、上場企業IR資料の実例から図形活用パターンを体系解説）由来。
紹介パターンの大半（ロジックツリー/フローチャート/マトリックス/バブル/ピラミッド/ファネル/
数式/タイムライン/概念曲線/吹き出し注釈/ビジネスモデル図）は他セクションの型がカバーする。
円グラフ・扇型強調は上記の非推奨判断を維持して取り込まず、頂点編集・図形結合は
カスタムジオメトリ禁止（§6）のため取り込まない。

✅ tam_sam_som（市場規模の入れ子円。下端揃えOVAL3つ・TAM→SAM→SOM固定順。
  render_frameworks3.py）
✅ roadmap（レーン×期間のスパンバー。journey_mapのグリッド様式を踏襲し、rowsの期間指定
  "Q1"/"Q1-Q3"を該当列にまたがるバーとして描画。render_frameworks2.py）

---

## 5. Sonnetでも安定するDSL設計原則（再掲・実装時に厳守）

1. 要素数の上限を型ごとに固定（超過分はレンダラが切り捨て）
2. 座標(x,y,w,h,ptサイズ)はDSLに一切登場させない
3. ラベル名は自由文字列でなくenum/プリセット（variantで引く）
4. リスト構造は1階層平坦に（ネスト禁止）
5. 必須フィールド最小限、デフォルト値で補完
6. フィールド名を全型で統一（title/items/note/source）
7. 「型を選ぶ」と「中身を書く」を分離
8. 色・フォント・余白はDSLに書かせない
9. 数値はラベル付きペアで（{label,value,unit,delta}）
10. YAML推奨、ただしスキーマ厳格検証

---

## 6. 設計思想（全型で守る）

- 1スライド1メッセージ
- 配色 70:25:5（theme.py で固定、accentは強調1箇所のみ）
- 装飾最小（影なし、罫線グレー、角丸控えめ）
- ネイティブ図形のみ（画像化しない＝編集可能）
- **標準プリセット図形のみ使用**（カスタムジオメトリ/回転/flipはPowerPointで崩れるため禁止）
- 円グラフ・3D・ゲージ非推奨
- テスト駆動：新型実装後は必ず pytest（第1層）→ モンタージュ目視（第2層）

---

## 7. 出典（主要なもの）

- コンサル/チャート: stratechi.com, deckary.com, theanalystacademy.com, think-cell.com
- フレームワーク: strategyzer.com, nngroup.com, mindtools.com
- SpeakerDeck/SlideShare: speakerdeck.com/coneinc/(39パターン), twada, t_wada系
- デザイン論: duarte.com, garrreynolds.com, presentationzen
- 教育/学術: prisma-statement.org, theteachertoolkit.com
- 日本: cone-c-slide.com, rubato.co, note.com/powerpoint_jp
- tsundoku: mrkxlia/tsundoku の資料作成ノウハウ記事5本（詳細URLは
  [design-guidelines.md](../skills/slidegen/references/design-guidelines.md) 末尾の出典表を参照）


## 運用機能（型ではないが重要）

✅ 手編集同期(sync.py)：生成→人がPowerPointで文言修正→`python -m slidegen.sync x.slide x.pptx --apply`で記法に反映。生成と手修正のループが回る。
