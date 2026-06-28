// phases.ts — フェーズ遷移・タグ判定・履歴トリミング。
// slidegen_app.py のフェーズ制御ロジックを移植。

import type { Phase } from "./prompts";

export type Role = "user" | "assistant";
export interface Message { role: Role; content: string; }

// フェーズ遷移タグ（本文には出さず、判定にのみ使う）
export const TAGS = {
  READY_FOR_OUTLINE: "[READY_FOR_OUTLINE]",
  OUTLINE_READY: "[OUTLINE_READY]",
  READY_TO_GENERATE: "[READY_TO_GENERATE]",
} as const;

export interface TagScan {
  cleaned: string;        // タグを除去した表示用テキスト
  readyForOutline: boolean;
  outlineReady: boolean;
  readyToGenerate: boolean;
}

// LLM 応答からタグを検出し、表示用に除去する。
export function scanTags(text: string): TagScan {
  const readyForOutline = text.includes(TAGS.READY_FOR_OUTLINE);
  const outlineReady = text.includes(TAGS.OUTLINE_READY);
  const readyToGenerate = text.includes(TAGS.READY_TO_GENERATE);
  let cleaned = text;
  for (const t of Object.values(TAGS)) cleaned = cleaned.split(t).join("");
  return { cleaned: cleaned.trim(), readyForOutline, outlineReady, readyToGenerate };
}

// 次フェーズを決める。READY_TO_GENERATE が最優先（流れを省いて直接生成へ）。
export function nextPhase(current: Phase, scan: TagScan): Phase {
  if (scan.readyToGenerate) return "dsl";
  if (current === "hearing" && scan.readyForOutline) return "outline";
  if (current === "outline" && scan.outlineReady) return "dsl";
  return current;
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

// 生成済みDSLからコードフェンス記号を除去（生成出力のサニタイズ）。
export function stripFences(text: string): string {
  return text.split("```").join("").trim();
}

// 生成出力から DSL 本体だけを取り出す。
// コードフェンスを除去し、最初の行頭 `slide <type>` より前（思考過程・前置き）を捨てる。
// 思考型モデル(Gemini 3.x 等)が reasoning を本文に混ぜても、preview/render が
// 壊れないようにするための堅牢化。`slide` が見つからなければ従来どおり全体を返す。
export function stripToDsl(text: string): string {
  const noFence = text.split("```").join("");
  const m = noFence.match(/^slide[ \t]+\S+/m);
  return (m?.index != null ? noFence.slice(m.index) : noFence).trim();
}

// レビュー等の出力から思考過程の前置きを除去し、最初の Markdown 見出し(### …)以降を返す。
// 思考型モデルが冒頭に長い reasoning を吐いても、講評を読みやすく表示するため。
// 見出しが無ければ全体を返す（フォールバック）。
export function stripReasoning(text: string): string {
  const m = text.match(/^#{1,6}[ \t]\S/m);
  return (m?.index != null ? text.slice(m.index) : text).trim();
}
