// providers.ts — LLM プロバイダ横断の抽象化（全て async fetch）。
//
// 旧 Python 版(同期SDK・Azure中心、現存しない) を置き換えた実装。Cloudflare Worker は
// 非同期 HTTP のみ許可されるため、各プロバイダを fetch で実装する。
//
// セキュリティ(SSRF不変条件): エンドポイント URL は本ファイル内に固定し、
//   フロントからは URL/base_url を一切受け取らない。受け取るのは
//   provider(列挙)・model・system・messages のみ。
//
// 移植性: workers_ai のみ Cloudflare 依存（env.AI バインディング）。Node/Bun へ
//   移植する場合は catalog から workers_ai を外し gemini/openrouter に倒す。
export type Provider =
  | "gemini"
  | "openrouter"
  | "workers_ai"
  | "openai"
  | "anthropic";

export type Tier = "free" | "prod";

// 添付画像（base64、data-URI プレフィックス無し）。vision 対応モデルにのみ実際に送られる。
export interface ImagePart {
  mimeType: string;
  data: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: ImagePart[];
}

export interface ChatRequest {
  provider: Provider;
  model: string;
  system?: string;
  messages: ChatMessage[];
  // Gemma 等 systemInstruction 非対応モデル: system を先頭 user に畳む。
  noSystemInstruction?: boolean;
  // vision 対応モデルか。false のとき各エンコーダは messages[].images を黙って剥がす
  // （フォールバック先が非 vision でも安全に劣化＝従来のテキストのみ動作）。
  vision?: boolean;
}

export class LLMError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status = 502, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

export interface ProviderEnv {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_AI_API_TOKEN?: string;
}

export interface ModelEntry {
  id: string; // 表示用ID
  label: string;
  provider: Provider;
  model: string; // 実モデル名
  tier: Tier;
  // Gemma 等 systemInstruction 非対応モデルは true（system を先頭 user に畳む）。
  noSystemInstruction?: boolean;
  // DSL(構造化出力)に十分信頼できるか。frontend の「DSL 無効時フォールバック」選択に使う
  // （特定モデルIDをフロントにハードコードしないための単一情報源）。未指定=信頼可、
  // Gemma 系は劣化で無効DSLを出しがちなので false。
  reliableForDsl?: boolean;
  // 画像入力(vision)対応か。未指定=非対応（保守的既定）。frontend は vision モデル選択時のみ
  // 添付画像を送り、gateway 側エンコーダも非 vision モデルには images を渡さない。
  vision?: boolean;
}

// 表示モデル一覧。free=テスト用(無料枠) / prod=本番(要 secret)。
const CATALOG: ModelEntry[] = [
  // --- 無料枠（テスト）。並び順＝既定優先度＝実キーの RPM 大きい順。
  //     ※更新手順は docs/model-catalog.md（確認日: 2026-07-03）。
  //       gemini-2.0-flash 系は 2026-06-01 シャットダウン済のため不採用。
  //       gemini-2.5-flash / 2.5-flash-lite は 2026-10-16 廃止予定（後継: 3.5-flash / 3.1-flash-lite）→ 期日までに削除。
  //       deepseek/deepseek-r1:free は OpenRouter から消滅（2026-07 確認）→ gpt-oss-120b:free に置換済み。
  //       vision: Gemini Flash 系・GPT-4o・Claude は画像入力対応。Gemma/Llama/GPT-OSS はテキスト専用（未指定）。
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (無料・最大枠)", provider: "gemini", model: "gemini-3.1-flash-lite", tier: "free", reliableForDsl: true, vision: true },
  { id: "gemma-4-31b", label: "Gemma 4 31B (無料・TPM無制限)", provider: "gemini", model: "gemma-4-31b-it", tier: "free", noSystemInstruction: true, reliableForDsl: false },
  { id: "gemma-4-26b", label: "Gemma 4 26B (無料・TPM無制限)", provider: "gemini", model: "gemma-4-26b-a4b-it", tier: "free", noSystemInstruction: true, reliableForDsl: false },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (無料・〜2026-10)", provider: "gemini", model: "gemini-2.5-flash-lite", tier: "free", reliableForDsl: true, vision: true },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (無料・〜2026-10)", provider: "gemini", model: "gemini-2.5-flash", tier: "free", reliableForDsl: true, vision: true },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (無料・高性能)", provider: "gemini", model: "gemini-3.5-flash", tier: "free", reliableForDsl: true, vision: true },
  { id: "or-gpt-oss-120b", label: "OpenRouter: GPT-OSS 120B (無料)", provider: "openrouter", model: "openai/gpt-oss-120b:free", tier: "free", reliableForDsl: true },
  { id: "or-llama-3.3-70b", label: "OpenRouter: Llama 3.3 70B (無料)", provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", tier: "free", reliableForDsl: true },
  { id: "wai-llama-3.3-70b", label: "Workers AI: Llama 3.3 70B (無料)", provider: "workers_ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", tier: "free", reliableForDsl: true },
  // --- 本番（要 API キー） ---
  { id: "gpt-4o", label: "OpenAI: GPT-4o (本番)", provider: "openai", model: "gpt-4o", tier: "prod", reliableForDsl: true, vision: true },
  { id: "claude-sonnet", label: "Anthropic: Claude Sonnet (本番)", provider: "anthropic", model: "claude-sonnet-4-6", tier: "prod", reliableForDsl: true, vision: true },
];

// secret の有無で「実際に使えるモデルだけ」を返す。
export function availableModels(env: ProviderEnv): ModelEntry[] {
  return CATALOG.filter((m) => {
    switch (m.provider) {
      case "gemini":
        return !!env.GEMINI_API_KEY;
      case "openrouter":
        return !!env.OPENROUTER_API_KEY;
      case "workers_ai":
        return !!env.AI || (!!env.CF_ACCOUNT_ID && !!env.CF_AI_API_TOKEN);
      case "openai":
        return !!env.OPENAI_API_KEY;
      case "anthropic":
        return !!env.ANTHROPIC_API_KEY;
      default:
        return false;
    }
  });
}

export function findModel(id: string): ModelEntry | undefined {
  return CATALOG.find((m) => m.id === id);
}

// フォールバック候補チェーン: [primary, …同 tier で利用可能な別IDモデル]（CATALOG順）。
// 同プロバイダ・別モデルも許可する（全 free が gemini の構成でも機能させるため）。
export function fallbackChain(primaryId: string, env: ProviderEnv): ModelEntry[] {
  const primary = findModel(primaryId);
  if (!primary) return [];
  const rest = availableModels(env).filter(
    (m) => m.id !== primary.id && m.tier === primary.tier,
  );
  return [primary, ...rest];
}

// vision 対応モデルのときだけ実際に画像を使う。非 vision へのフォールバック時は
// エンコーダ側で黙って剥がす（従来のテキストのみ動作に安全に劣化させるため）。
// 3プロバイダ(Gemini/OpenAI互換/Anthropic)のエンコーダで共通の最初の一歩。
export function imagesFor(req: ChatRequest, m: ChatMessage): ImagePart[] {
  return (req.vision && m.images) || [];
}

// Gemini(generativelanguage) 用リクエスト body を組み立てる。
// noSystemInstruction(=Gemma) の場合は systemInstruction を使わず、
// system を先頭 user メッセージに前置して畳み込む。
// vision のとき messages[].images を inline_data パートとして text の前に並べる（非 vision は剥がす）。
export function buildGeminiPayload(
  req: ChatRequest, maxTokens: number, temperature: number,
): Record<string, unknown> {
  const msgs = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    text: m.content,
    images: imagesFor(req, m),
  }));
  if (req.noSystemInstruction && req.system) {
    // systemInstruction 非対応 → 先頭 user に前置（先頭が user でなければ user を挿入）。
    if (msgs.length && msgs[0].role === "user") {
      msgs[0] = { ...msgs[0], text: `${req.system}\n\n${msgs[0].text}` };
    } else {
      msgs.unshift({ role: "user", text: req.system, images: [] });
    }
  }
  const body: Record<string, unknown> = {
    contents: msgs.map((m) => ({
      role: m.role,
      parts: [
        ...m.images.map((im) => ({ inline_data: { mime_type: im.mimeType, data: im.data } })),
        { text: m.text },
      ],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  if (req.system && !req.noSystemInstruction) {
    body.systemInstruction = { parts: [{ text: req.system }] };
  }
  return body;
}

