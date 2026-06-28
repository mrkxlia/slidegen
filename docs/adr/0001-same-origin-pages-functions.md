# 0001. ゲートウェイを独立 Worker でなく Pages Functions として同一オリジン配信する

- ステータス: 採用 (Accepted)
- 日付: 2026-06-27
- 関連: PR #3, `docs/deployment.md`, `frontend/functions/api/[[path]].ts`, `gateway/src/pages.ts`

## コンテキスト

slidegen Web アプリは Cloudflare 無料枠で動かす。構成要素は次の3つ:

- **フロント**: Cloudflare Pages（React+Vite+TS）。pptx 生成はブラウザ内 Pyodide。
- **API(LLM 中継)**: Hono 製ゲートウェイ（`gateway/src`）。鍵を秘匿し LLM へ中継する。
- **認証**: Cloudflare Access（エッジ）＋ ゲートウェイ内 JWT 検証。

当初の素朴案は「フロント＝`*.pages.dev` / API＝独立 Worker `*.workers.dev`」という**クロスオリジン**構成だった。しかし実装を読むと、この構成では認証が成立しない:

- `frontend/src/api.ts` は `/api` を **`credentials:"include"`（Cookie 同送）**で呼ぶ。
- `gateway/src/auth.ts` は Access が注入する **`Cf-Access-Jwt-Assertion` ヘッダ**、無ければ **`CF_Authorization` Cookie** で検証する。

クロスオリジンだと:

1. **`*.workers.dev` は自分の Cloudflare ゾーンではない**ため、Cloudflare Access の self-hosted アプリで**保護できない**（独立 Worker をエッジ認証下に置けない）。
2. Access の `CF_Authorization` Cookie は**アプリのドメイン単位**で発行され、`*.pages.dev` でログインしても**別サイト `*.workers.dev` には届かない**（cross-site／`SameSite`）。

結果、`/api` は常にトークン無し＝**401/500（`ACCESS_AUD` 未設定ならフェイルクローズ 500）**になり、`/api/models` を初回に呼ぶアプリは起動直後に機能停止する。

制約として、ユーザーは **Cloudflare 管理下の独自ドメイン（ゾーン）を持たない**。独自ドメインがあれば「カスタムドメインに Worker を `/api/*` ルートでマウント」して同一オリジン化できるが、その前提が無い。

## 決定

**ゲートウェイの Hono アプリを独立 Worker としてではなく、フロントと同じ Pages プロジェクト上の Pages Functions として配信する。** これにより `/api/*` が静的配信と**同一オリジン**になり、Access を **Pages プロジェクト**に付与すれば Function 宛にも `Cf-Access-Jwt-Assertion` が注入され、既存の `auth.ts` がそのまま機能する。本番は **Pages 一本**に集約され、独立 Worker のデプロイは不要になる。

実装方針（既存コードを最大限温存）:

- `gateway/src` の**ロジックは無改変**（テストの正本として温存）。アダプタ entry のみ追加:
  - `gateway/src/pages.ts`: `import { handle } from "hono/cloudflare-pages"; import app from "./index"; export const onRequest = handle(app);`
  - `frontend/functions/api/[[path]].ts`: `export { onRequest } from "../../../gateway/src/pages";`（**再エクスポート1行のみ**）
- `handle()` は**パスを書き換えず** Hono に委譲するため、既存の `/api/health|models|chat` ルートがそのまま一致する。
- 依存（`hono`/`jose`）は **gateway 側ファイル発で解決**される＝バンドル時 `gateway/node_modules` 一箇所に収束（hono の二重インスタンスを回避）。frontend のシムは hono を直接 import しない。
- bindings/vars は `frontend/wrangler.toml`（`[ai]` binding、`ALLOWED_ORIGIN`/`ACCESS_*`/上限/レート）。LLM 鍵は **Pages secret**（`wrangler pages secret put`）。
- Access は Pages プロジェクトに付与し、発行された **AUD** を `wrangler.toml` の `ACCESS_AUD` に設定。
- ローカル開発は従来どおり `gateway` の `wrangler dev`(:8787) ＋ vite proxy（ブラウザから見て同一オリジン）。Pages Functions 化は本番配信用の薄いシムで、ローカル dev/test には影響しない。

## 結果

良い点:

- **同一オリジン＋Cookie/ヘッダ認証**が設計どおり成立。独自ドメイン不要。
- 本番が Pages 一本になり、**CD が `pages deploy` 1 ステップ**で完結。
- `gateway/src` 無改変でテスト資産を維持。

トレードオフ・注意:

- **依存解決の罠**: Functions のバンドルは `gateway/node_modules` を要する。CD は frontend だけでなく **`gateway` でも `npm ci`** する必要がある（忘れると「ローカルは通るが CD だけバンドル失敗」）。`.github/workflows/ci.yml` の deploy job に明記。
- **型検査の分離**: functions は Worker 型（`@cloudflare/workers-types`）を要するため、frontend 本体 tsc に含めず **functions 専用 tsconfig**（`frontend/functions/tsconfig.json`）で個別検査する。
- **Access はエッジで `/api/health` も保護**する（app 層の health 認証免除はエッジでは効かない）。未認証ヘルスチェック前提のものがあれば破れる。
- **`ALLOWED_ORIGIN`/CORS は同一オリジンでは実質無意味**（設定は残すが到達制御には効かない）。
- **Pages プロジェクト名 `slidegen` はグローバル一意**。取得済みなら実 URL に合わせて `ALLOWED_ORIGIN`・Access 対象・`wrangler.toml` を調整。

## 検討した代替案

- **クロスオリジン（独立 Worker）**: 上記の理由で認証不成立。却下。
- **独自ドメイン＋Worker を `/api/*` ルート**: 最も素直な同一オリジン化だが、Cloudflare 管理ドメインが前提。ドメインを取得すればこの構成へ移行可能（その場合は本 ADR を Superseded とし Worker ルート構成へ）。
- **フロントから Access JWT を明示送信**: フロントは httpOnly な Access Cookie を読めず、そもそも `*.workers.dev` が Access 下に無いため不成立。却下。
