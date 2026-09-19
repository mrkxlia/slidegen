# slidegen 課題・ネクストアクション（backlog）

> **本プロジェクトは機能追加を終了し、凍結運用に入っている。** 型カタログ（`RENDERERS`）と
> public API は現状で確定とし、新機能・新型は追加しない。残るのは下記のユーザー作業と、
> 使い続ける限りの最小限の追随だけ。判断の経緯は [history.md](history.md) を参照。
> 関連: [requirements.md](../requirements.md) / [spec.md](../spec.md) / [docs/adr/](adr/)
> 最終更新: 2026-09-19

## 🟡 ユーザー作業（外部サービスの後片付け。Claude からは操作不可・**未実施**）

**現時点で唯一の未処理項目。** 旧構成で使っていた外部リソースの後片付け
（経緯は [history.md](history.md) 参照）。public リポジトリに残り続けるため、優先して消す:

- [ ] Cloudflare Zero Trust チーム `mrxlia`（`mrxlia.cloudflareaccess.com`）の Access アプリ削除
      （旧 Pages プロジェクト向け、AUD `5ac4a021…17c03`）とそのポリシー。
- [ ] 旧 GitHub secrets に入れていた Cloudflare API トークン本体の失効
      （dash.cloudflare.com → My Profile → API Tokens。Pages:Edit スコープ）。
- [ ] LLM API キー（GEMINI_API_KEY / OPENROUTER_API_KEY、任意で OPENAI/ANTHROPIC）のローテーション検討
      （環境変数としては消滅済みだが、キー自体の失効は別途要判断）。

## 使い続ける限りの追随（発生ベース。定期作業にはしない）

- **skills-ref の commit SHA ピン留め**: `.github/workflows/ci.yml` と `Makefile` の `validate-skill` が
  参照する agentskills リポジトリの SHA ピンは、破壊的変更を CI で拾わないためのトレードオフ。
  CI が落ちたときに更新すればよく、先回りして追う必要はない。
- **`python-pptx` の追随**: ランタイム依存はバージョン未固定。上流が破壊的変更を出して CI が落ちたときに
  対応する。

## やらないと決めたもの（凍結にあたっての決定）

いずれも「実装作業であって、このプロジェクトが検証したかった仮説とは無関係」と判断した。
再開したくなった場合は、この節を消してから着手する。

- **pptx → DSL の決定的双方向化**（[ADR 0003](adr/0003-provenance-roundtrip.md) の手段2）— やらない。
  ADR 0003 の責務分離（出自不明 pptx は LLM 取り込み＝実装済み）で実用上は足りており、
  プロベナンス埋め込みの実装量に見合わない。`sync` は文言差分のみ対応のまま確定とする。
- **技術図 Mermaid 連携** — やらない。`render_tech_diagrams.py` の標準図形合成で用は足りている。
- **i18n** — やらない。[requirements.md](../requirements.md) R2 のとおり日本語前提を維持する。
- **PyPI 公開** — やらない。`uvx --from git+...` と `/plugin marketplace add` で配布経路は足りている。
  レンダ時に github.com へのネットワークアクセスが必要である点は
  [SKILL.md](../skills/slidegen/SKILL.md) の `compatibility` に明記済み。
- **新しい型の追加** — やらない。型を増やすと `dsl-reference.md`（AI が DSL 記述前に全文読む正本）が
  比例して膨らみ、1デッキあたりのコンテキスト消費が増える。現在の 168 型で確定とする。

## 意図的に対応しないもの（記録）

- `slidegen/scaffold_type.py` の `# TODO: レイアウト(...)に従って配置を実装` は、新型を起こす際に
  人間が埋める**生成テンプレート内のガイド用プレースホルダ**であり本体の未実装ではない。
  消すとガイドが失われるため意図的に残す。
