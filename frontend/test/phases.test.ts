import { describe, it, expect } from "vitest";
import {
  cleanReply, extractFencedDsl, trimHistory, stripToDsl, stripReasoning, hasValidDsl, type Message,
} from "../src/phases";

describe("cleanReply", () => {
  it("残存タグを除去する", () => {
    expect(cleanReply("これで作れます\n[READY_TO_GENERATE]")).toBe("これで作れます");
    expect(cleanReply("流れ案[OUTLINE_READY]")).toBe("流れ案");
  });
  it("タグ無しはそのまま（trim のみ）", () => {
    expect(cleanReply("質問です")).toBe("質問です");
    expect(cleanReply("  前後空白  ")).toBe("前後空白");
  });
});

describe("extractFencedDsl", () => {
  it("コードフェンス内の DSL を取り出す", () => {
    const txt = "### 講評\nよい\n### 改善後DSL\n```\nslide title\n  headline \"x\"\n```";
    expect(extractFencedDsl(txt)).toContain("slide title");
  });
  it("フェンス無しは null", () => {
    expect(extractFencedDsl("slide title")).toBeNull();
  });
});

describe("trimHistory / stripToDsl", () => {
  it("直近Nターンに絞る", () => {
    const msgs: Message[] = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: String(i) }));
    expect(trimHistory(msgs, 10)).toHaveLength(10);
    expect(trimHistory(msgs, 10)[0].content).toBe("20");
  });
  it("stripToDsl: 思考過程の前置きを捨てて slide 本体から返す", () => {
    const out = stripToDsl(
      "* Goal: output only DSL\n* Constraints:\n  * `slide title` example\n\nslide title\n  title \"X\"\n---\nslide bullets\n  items \"a\"",
    );
    expect(out.startsWith("slide title")).toBe(true);
    expect(out).not.toContain("Goal:");
    expect(out).toContain("slide bullets");
  });
  it("stripToDsl: コードフェンス付きでも本体を取り出す", () => {
    expect(stripToDsl("```dsl\nslide title\n  title \"X\"\n```")).toBe('slide title\n  title "X"');
  });
  it("stripToDsl: slide が無ければ全体を返す（フォールバック）", () => {
    expect(stripToDsl("no dsl here")).toBe("no dsl here");
  });
  it("stripReasoning: 見出し前の思考過程を捨てて ### から返す", () => {
    const out = stripReasoning("* Plan: think...\n* Wait, reconsider.\n\n### 講評\n- 良い点\n\n### 改善後DSL\n```\nslide title\n```");
    expect(out.startsWith("### 講評")).toBe(true);
    expect(out).not.toContain("Plan:");
    expect(out).toContain("### 改善後DSL");
  });
  it("stripReasoning: 見出しが無ければ全体を返す", () => {
    expect(stripReasoning("ただのテキスト")).toBe("ただのテキスト");
  });
  it("hasValidDsl: slide 行があれば true", () => {
    expect(hasValidDsl('slide title\n  title "X"')).toBe(true);
    expect(hasValidDsl('# 前置き\n\nslide bullets\n  items "a"')).toBe(true);
  });
  it("hasValidDsl: slide 行が無ければ false（劣化出力ガード）", () => {
    expect(hasValidDsl("}\n}\n}\n}")).toBe(false);
    expect(hasValidDsl("")).toBe(false);
    expect(hasValidDsl("ただのテキスト")).toBe(false);
  });
});
