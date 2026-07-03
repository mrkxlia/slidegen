// phases.ts — 応答の表示用クリーニング・DSL 抽出・履歴トリミング。
// フェーズ制御ロジックは旧 Streamlit 版 Python から移植（元 .py は現存しない）。phase は会話起点ワークスペースの進行ステッパーに反映。

export type Role = "user" | "assistant";
// images: 添付画像（base64、data-URI プレフィックス無し）。vision 対応モデル選択時のみ App が付与し、
// gateway がプロバイダ別形式（Gemini inline_data / OpenAI系 image_url / Anthropic blocks）に変換する。
export interface MessageImage { mimeType: string; data: string; }
export interface Message { role: Role; content: string; images?: MessageImage[]; }

// 旧フェーズ遷移タグの除去用。UIは手動進行に移行したためタグでの遷移はしないが、
// 過去履歴や移行期のモデル出力に残るタグを表示前に取り除く（安全側のクリーニング）。
const TAG_RE = /\[(READY_FOR_OUTLINE|OUTLINE_READY|READY_TO_GENERATE)\]/g;

// LLM 応答を表示用にクリーニングする（残存タグの除去）。
export function cleanReply(text: string): string {
  return text.replace(TAG_RE, "").trim();
}

// コードフェンス内の DSL を取り出す（review 出力の「改善後DSL」用）。
export function extractFencedDsl(text: string): string | null {
  if (!text.includes("```")) return null;
  const parts = text.split("```");
  const blocks = parts.length >= 3 ? parts.slice(1, -1) : parts;
  for (let i = blocks.length - 1; i >= 0; i--) {
    let body = blocks[i].trim();
    const lower = body.toLowerCase();
    if (lower.startsWith("text\n") || lower.startsWith("dsl\n")) {
      body = body.slice(body.indexOf("\n") + 1);
    }
    if (body.includes("slide ")) return body.trim();
  }
  return null;
}

// 履歴トリミング: 先頭 system + 添付要約は別管理。ここでは直近Nターンに絞る。
// 無料モデルの context 超過・コスト悪化を防ぐ。
export function trimHistory(messages: Message[], maxTurns = 16): Message[] {
  if (messages.length <= maxTurns) return messages;
  return messages.slice(messages.length - maxTurns);
}

// 行頭 `slide <type>` の検出パターン（DSL本体の開始）。stripToDsl と hasValidDsl で共有。
const SLIDE_LINE = /^slide[ \t]+\S+/m;

// 生成出力から DSL 本体だけを取り出す。
// コードフェンスを除去し、最初の行頭 `slide <type>` より前（思考過程・前置き）を捨てる。
// 思考型モデル(Gemini 3.x 等)が reasoning を本文に混ぜても、preview/render が
// 壊れないようにするための堅牢化。`slide` が見つからなければ従来どおり全体を返す。
export function stripToDsl(text: string): string {
  const noFence = text.split("```").join("");
  const m = noFence.match(SLIDE_LINE);
  return (m?.index != null ? noFence.slice(m.index) : noFence).trim();
}

// DSL 本体（行頭 `slide <type>`）を1つでも含むかの妥当性チェック。
// 生成完了時のゲート / preview・render 前のガードに使い、無効テキストを Pyodide へ
// 渡して Python traceback を露出させないための堅牢化。
export function hasValidDsl(text: string): boolean {
  return SLIDE_LINE.test(text);
}

// レビュー等の出力から思考過程の前置きを除去し、最初の Markdown 見出し(### …)以降を返す。
// 思考型モデルが冒頭に長い reasoning を吐いても、講評を読みやすく表示するため。
// 見出しが無ければ全体を返す（フォールバック）。
export function stripReasoning(text: string): string {
  const m = text.match(/^#{1,6}[ \t]\S/m);
  return (m?.index != null ? text.slice(m.index) : text).trim();
}

// DSL が無効だったときの代替モデルを選ぶ（純関数・テスト可能）。
// /api/models が返す順（= カタログ既定優先度）で「現行以外かつ reliableForDsl」の最初を選び、
// 無ければ現行以外の最初を返す。特定モデルID/プロバイダ名に依存しない（カタログが単一情報源）。
export function pickDslFallback(
  models: { id: string; reliableForDsl?: boolean }[],
  currentId: string,
): string | undefined {
  const others = models.filter((m) => m.id !== currentId);
  return (others.find((m) => m.reliableForDsl) ?? others[0])?.id;
}
