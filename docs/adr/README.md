# Architecture Decision Records (ADR)

このプロジェクトの重要な設計判断を記録する。各 ADR は「コンテキスト → 決定 → 結果（トレードオフ）→ 代替案」を簡潔にまとめた不変の記録で、後から状況が変われば新しい ADR で **Superseded** にする（過去の ADR は書き換えない）。

| # | タイトル | ステータス | 日付 |
|---|---|---|---|
| [0001](0001-uv-for-python-packaging.md) | Python のパッケージ管理・ビルドを uv に統一する | 採用 | 2026-06-27 |
| [0002](0002-editable-native-pptx.md) | 出力は編集可能なネイティブ pptx とし、画像化しない | 採用 | 2026-06-28 |
| [0003](0003-provenance-roundtrip.md) | pptx↔DSL双方向化：出自不明pptxはLLM取り込み、slidegen生成物はプロベナンス方式に責務分離 | 採用 | 2026-07-05 |

新規追加: 連番 `NNNN-kebab-title.md` で作成し、この表に1行足す。

> 過去に存在した Web アプリ期の ADR（削除済み）の要約と番号の変遷は
> [docs/history.md](../history.md) を参照。
