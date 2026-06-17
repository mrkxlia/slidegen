// auth.ts — Cloudflare Access (Zero Trust) の JWT 検証。
//
// 多層防御の「アプリ層」。Access はエッジでも遮断するが、workers.dev 直叩きや
// 設定ミスに備え、Worker 自身でも `Cf-Access-Jwt-Assertion` を検証する。
//
// 重要(セキュリティ):
//   - JWKS は team ドメイン配下の「全 Access アプリ共通」。aud(App AUD) を
//     文字列完全一致で必須検証しないと、別アプリ向けの有効 JWT で通過されうる。
//   - ACCESS_AUD / ACCESS_TEAM_DOMAIN が未設定なら「フェイルクローズ」= 全拒否。
//
// 移植性: ここが唯一の Cloudflare Access 依存。自前 IdP(OIDC) に差し替える場合は
//   この関数だけを置き換える（issuer/JWKS/claim を読み替える）。
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_BYPASS_AUTH?: string;
}

export interface AuthResult {
  ok: boolean;
  status: number;
  email?: string;
  error?: string;
}

// team ごとに JWKS をキャッシュ（モジュールスコープ。Worker isolate 内で再利用）。
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(teamDomain: string) {
  const issuer = `https://${teamDomain}.cloudflareaccess.com`;
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(issuer, jwks);
  }
  return { jwks, issuer };
}

export async function verifyAccess(req: Request, env: AuthEnv): Promise<AuthResult> {
  // ローカル開発専用バイパス（本番では DEV_BYPASS_AUTH を設定しない）。
  if (env.DEV_BYPASS_AUTH === "1") {
    return { ok: true, status: 200, email: "dev@localhost" };
  }

  // フェイルクローズ: 設定が無ければ検証不能 → 全拒否（500）。
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return {
      ok: false,
      status: 500,
      error:
        "Auth misconfigured: ACCESS_TEAM_DOMAIN / ACCESS_AUD must be set (fail-closed).",
    };
  }

  const token =
    req.headers.get("Cf-Access-Jwt-Assertion") ||
    // ブラウザ直 fetch では Cookie でも届く
    parseCookie(req.headers.get("Cookie"), "CF_Authorization");
  if (!token) {
    return { ok: false, status: 401, error: "Missing Access JWT" };
  }

  const { jwks, issuer } = getJWKS(env.ACCESS_TEAM_DOMAIN);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD, // aud 完全一致を必須検証
    });
    return { ok: true, status: 200, email: (payload.email as string) || undefined };
  } catch (e) {
    return { ok: false, status: 401, error: `Invalid Access JWT: ${(e as Error).message}` };
  }
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
