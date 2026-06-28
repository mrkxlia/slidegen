// Cloudflare Pages Functions エントリ: /api/* を slidegen ゲートウェイへ委譲する。
//
// 中身は持たず gateway/src/pages の onRequest を再エクスポートするだけ。
// 理由: hono/jose 等の依存を gateway/node_modules 一箇所で解決させ、hono の
// 二重インスタンス化と「frontend だけ npm ci した CD でバンドル失敗」を防ぐ。
// （CD は gateway 側も npm ci する。詳細は docs/deployment.md / .github/workflows/ci.yml）
export { onRequest } from "../../../gateway/src/pages";
