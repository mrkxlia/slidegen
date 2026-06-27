// pages.ts — slidegen ゲートウェイ(Hono)を Cloudflare Pages Functions として配信するアダプタ。
//
// なぜ存在するか:
//   独自ドメイン(ゾーン)無しで「同一オリジン」を満たすため、LLM 中継 Worker を
//   独立 Worker ではなく Pages Functions として静的配信と同じオリジンに載せる。
//   こうすると Cloudflare Access の Cookie / Cf-Access-Jwt-Assertion が /api/* にも
//   届き、既存の auth.ts がそのまま機能する（クロスオリジンでは Cookie が届かない）。
//
//   ./index の Hono app は無改変。frontend/functions/api/[[path]].ts はこの onRequest を
//   再エクスポートするだけ。hono/jose 等の依存は本ファイル発で解決されるため、
//   バンドル時は gateway/node_modules 一箇所に収束する（hono の二重インスタンスを回避）。
import { handle } from "hono/cloudflare-pages";
import app from "./index";

export const onRequest = handle(app);
