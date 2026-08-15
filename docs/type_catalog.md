# slidegen 型カタログ 決定版

3回の調査（①コンサル/チャート系 ②SpeakerDeck/SlideShare系 ③全方位）で発掘した型を、
重複を排除して1つに統合した決定版。社内Claude Codeでの実装の指針として使う。

**最重要の結論**：個別型を量産するより、**9つの基底レイアウト**を実装し、その上に
「variant（ラベル・配置・強調位置の辞書）」を載せる方式（3軸分解：基底 × variant × 中身）が
圧倒的に効率的。9基底で約170型を吸収できる。

---

## 0. 実装ステータス凡例

- ✅ 実装済み（動作確認済み）
- 🔜 次に実装（優先度高）
- 📋 カタログ済み（未実装）
- ❌ 不採用（設計思想と不整合／画像必須／情報過密）

難度: ◎=矩形+テキストのみ ○=座標計算あり △=Mermaid流用 ×=画像必須
DSL: S=単純(ラベルのみ) N=普通 C=複雑

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

**実装の優先順位**：基底9種すべて実装完了 ✅（labeled_blocks / split_layout / grid_2d / nodes_and_connectors / hero_canvas / columns_with_header / narrative_curve / band_strip / framed_canvas）。
以降は個別型（チャート系など）を基底の上に追加していくフェーズ。

---

## 2. 実装済みの型（`RENDERERS` に計138型）

> **真実は `slidegen/render.py` の `RENDERERS`**（`uv run python -c "import slidegen,slidegen.render as r;print(len(r.RENDERERS))"`
> → 138）。本書は分類のための見取り図で、以下のセクション3も含め多くが既に ✅ 実装済み。
> 数の手入力は古くなりやすいので、網羅確認は `RENDERERS` を参照すること。

### ベース構成（既存）
✅ title / section / agenda / quote / bullets

### 内容パターン（既存）
✅ compare / cards / kpi / process / pros_cons / table

### 関係図（既存）
✅ matrix / cycle / pyramid / tree / formula / timeline / image_left

### 基底 labeled_blocks + variant（今回実装）
✅ labeled_blocks（基底本体）
✅ prep / sds / desc（話法フレーム）
✅ kishotenketsu / johakyu（物語フレーム）
✅ feia / haikei（分析・提案）
✅ kpt / ssc / fourls（ふりかえり）
✅ brand_pillars / sipoc / what_sowhat_nowwhat（フレームワーク）
✅ 5e / kwl（教育）

---

## 3. 基底 split_layout / grid_2d の variant（大半が ✅ 実装済み）

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

## 4. カタログ済み・未実装（基底ができたら順次追加）

### チャート系（①調査）— 基底とは別に専用実装が要るもの
✅ 基本チャート6種(bar_chart/bar_horizontal/line_chart/stacked_bar/stacked_100_bar/clustered_bar) ネイティブグラフ
   → python-pptx のネイティブChart APIで実装。現状の最大の空白。
✅ waterfall（増減分解・実装済み）
✅ bullet（ゲージ代替。目標vs実績。S5a, 2026-08）
✅ harvey_ball_table（定性比較●◐○。OVALのリング＋PIEの部分塗りで4段階を表現。S5a, 2026-08）
✅ funnel / scatter / bubble（S3, 2026-08: tsundokuのグラフ36枚実例分析で頻出度が高く優先度を引き上げ。
  根拠は design-guidelines.md §4） / marimekko / sankey / treemap / football_field（S5a, 2026-08 実装）
❌ 円グラフ・ゲージ・3D（設計思想で非推奨。stacked_100_bar/bulletで代替）

### ビジネスフレーム（①③調査）
✅ swot / ✅ venn2 / ✅ bmc（9ブロック固定）／ ✅ lean_canvas（9ブロック固定。S5b, 2026-08）
✅ value_chain ／ ✅ five_forces / 3c / 4p / pestel / bcg_matrix（S5b, 2026-08）
✅ journey_map（スイムレーン）／ ✅ empathy_map / persona_card（S5b, 2026-08）

### 技術資料（②調査）
✅ code_block / ✅ terminal / ✅ api_endpoint_table ／ ✅ code_diff / sql_result（S5c, 2026-08）
✅ sequence_diagram / state_transition / er_diagram（Mermaid流用と注記していたが、実装は
  Mermaidレンダリングではなく標準図形合成のみ。詳細は実行計画 S5c セクション参照。S5c, 2026-08）
✅ layered_stack / cloud_architecture / c4_context（S5c, 2026-08）
✅ slo_sli_table / incident_severity_table（S5c, 2026-08）

### 日本の登壇・ビジネス文化（②③調査）
✅ speaker_intro_card / cta_recruit（登壇サンドイッチの冒頭・締め。S5d, 2026-08）
✅ takahashi（高橋メソッド。takahashi_oneword は統合済み）／ ✅ takeaways_emoji（S5d, 2026-08）
✅ policy_3col ／ ✅ houkoku_sodan_irai（S5d, 2026-08）
（chapter_number_strip は実装済み chapter_band と、haikei_kadai_kaiketsu_kouka は
  実装済み haikei と同一意味論のためカタログから削除。S5d, 2026-08）

### 教育・学術（③調査）
📋 frayer_model / worked_example / theorem_proof / flashcard
📋 imrad_overview / abstract_slide / prisma_flow / consort_flow

### ストーリー・マーケ（③調査）
📋 golden_circle / storybrand_sb7 / pixar_story_spine
📋 aida_funnel / jtbd_statement ／ ✅ brand_pillars / pricing_tiers（他セクションでも実装済み表記あり）

### データ補助（③調査）
✅ data_source_footer（実装済み・ROI最大）
✅ big_fact / ✅ stat_trio ／ 📋 annotated_chart / before_after_metric

### 個人・イベント・ライフ（③調査）
✅ pricing_tiers ／ 📋 elevator_pitch / event_timetable / okr / maturity_model
📋 recipe_step / travel_itinerary / smart_goal

### tsundoku 知見由来の新規候補（S3, 2026-08）

tsundoku library の資料作成ノウハウ記事5本（詳細出典は
[design-guidelines.md](../skills/slidegen/references/design-guidelines.md) 末尾の出典表を参照）から
新たに浮かび上がった候補。39パターンのうち並列/比較/マトリクス/ベン図/ツリー/数式/フロー/サイクル/
ピラミッド/ビフォーアフター等は、既存の matrix/venn2/tree/formula/process/cycle/pyramid/before_after
等の実装済み型で対応済みのため追記不要（詳細な対応表は
[type-selection-guide.md](../skills/slidegen/references/type-selection-guide.md) を参照）。

✅ area_chart（累積面グラフ。line_chart系ネイティブチャート。S5a, 2026-08 実装。§4参照）
📋 pictogram_array（人型ピクトグラム配列＝ISOTYPE chart。grid_2d variant候補）
📋 dot_matrix_chart（10×10等のドットマトリクスで割合を面的に示す。grid_2d variant候補）
📋 org_chart（多段階層の組織図。nodes_and_connectors/tree variant候補。既存 tree は親+フラットな
  子1段のみのため、多段の報告ラインを示す型として現行未収録の穴）
📋 ranking_list（ランキング表。labeled_blocks/table variant候補）
📋 faq_qa（Q&A。labeled_blocks variant候補）
📋 mission_vision_values（MVV提示。labeled_blocks variant候補。既存 brand_pillars に近い3固定ロール版）

❌ キャプチャ画像の羅列・拠点の地図表示・導入実績のロゴ壁
   （画像依存が強く「ネイティブ図形のみ・画像化しない」設計思想＝§6 と不整合の可能性が高い）

円グラフ(C1-C5)を採用しなかった既存の判断（「❌ 円グラフ・ゲージ・3D」）は、グラフテンプレ36枚の
実例分析（Cleveland & McGillの読み取り精度知見）によっても裏付けられる。詳細は design-guidelines.md
§4 に引用済み。

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
