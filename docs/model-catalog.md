# モデルカタログの更新手順

> 対象: `gateway/src/providers.ts` の `CATALOG`。
> 無料枠モデルは入れ替わりが激しく、放置すると**稼働中アプリが静かに壊れる**（実例: `deepseek/deepseek-r1:free` が
> 2026-07 に OpenRouter から消滅していた）。**目安: 月1回、または LLM エラーが増えたら**この手順で棚卸しする。
> 関連: [ADR 0005](adr/0005-multi-provider-sse-fallback.md)（フォールバック設計）/ [backlog #1](backlog.md)

## 真実の所在

- モデルの唯一の情報源は **`gateway/src/providers.ts` の `CATALOG`**。frontend にモデル ID のハードコードは無く、
  `/api/models` が返す `{id, label, tier, reliableForDsl}` とカタログ順だけで選択・フォールバックが決まる。
- **並び順は仕様**: free tier の並び＝フォールバック優先度＝「実キーの RPM（レート上限）が大きい順」。
  追加時は性能順ではなく**枠の大きさ順**に置く。

## フィールドの意味

| フィールド | 意味 |
|---|---|
| `id` | 表示用 ID（frontend の選択値・localStorage に保存される）。変更すると利用者の保存設定が外れ、先頭モデルに自動フォールバックする（App.tsx が吸収）。 |
| `model` | プロバイダ API に渡す実モデル名。OpenRouter は `:free` サフィックスが無料枠。 |
| `tier` | `free`（無料枠）/ `prod`（要有料キー）。フォールバックは**同 tier 内のみ**。 |
| `noSystemInstruction` | Gemma 等 systemInstruction 非対応モデルは `true`（system を先頭 user に畳む）。 |
| `reliableForDsl` | DSL 出力を任せられるか。`false` のモデルは frontend の DSL 無効時フォールバック先から除外される（`frontend/src/phases.ts` の `pickDslFallback`）。未指定は信頼可扱い。 |
| `vision` | 画像入力対応か。**未指定=非対応**（保守的既定）。frontend は `vision:true` のモデル選択時のみ添付画像を送り、gateway 側エンコーダも非 vision モデルには `images` を渡さない。新モデル追加時はプロバイダ公式ドキュメントで画像入力対応を確認して付与。 |

## 棚卸し手順

1. **Gemini**: 公式の [models](https://ai.google.dev/gemini-api/docs/models) /
   [deprecations](https://ai.google.dev/gemini-api/docs/deprecations) ページで各 ID の廃止予定日を確認。
   キーがあれば models.list が確実:
   ```bash
   curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
     | python3 -c "import json,sys; print('\n'.join(m['name'] for m in json.load(sys.stdin)['models']))"
   ```
2. **OpenRouter**: 公開 API（認証不要）で `:free` モデルの存在を確認:
   ```bash
   curl -s https://openrouter.ai/api/v1/models \
     | python3 -c "import json,sys; ids=[m['id'] for m in json.load(sys.stdin)['data']]; print('\n'.join(i for i in ids if i.endswith(':free')))"
   ```
3. **Workers AI**: [モデル一覧](https://developers.cloudflare.com/workers-ai/models/) と
   [changelog](https://developers.cloudflare.com/changelog/)（deprecation 告知）を確認。
4. `CATALOG` を編集: 消滅したモデルは削除、廃止予定はラベルに「〜YYYY-MM」を付けてコメントに期日を書く。
   新規追加は `reliableForDsl` を判断して付与（小型/蒸留系で DSL が崩れがちなら `false`）。
5. コメント先頭の「確認日: YYYY-MM-DD」を更新する。

## ID を変更・削除したときに触る場所

- **`gateway/test/providers.test.ts`** — `gemini-2.5-flash` / `wai-llama-3.3-70b` の ID と
  `gemma` / `gemini` プレフィックス規約をハードコードしている。
- **`gateway/test/integration.test.ts`** — `gemini-2.5-flash`（多数）と `gemma-4-31b`（system 畳み込みテスト）。
- frontend は触らなくてよい（カタログ駆動）。

## 検証

```bash
cd gateway && npx vitest run && npx tsc --noEmit
# 実打ち（キーがある場合）: npx wrangler dev → GET /api/models → 代表モデルで POST /api/chat
```

## 既知の期日（次回アクション）

- **2026-10-16**: `gemini-2.5-flash` / `gemini-2.5-flash-lite` 廃止（earliest date）。
  期日前にカタログから削除する（後継 `gemini-3.5-flash` / `gemini-3.1-flash-lite` は登録済み）。
  → `gateway/test/` の `gemini-2.5-flash` 参照も別 ID（例: `gemini-3.5-flash`）へ書き換えが必要。
