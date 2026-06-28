import { describe, it, expect } from "vitest";
import {
  scanTags, nextPhase, extractFencedDsl, trimHistory, stripFences, stripToDsl, type Message,
} from "../src/phases";

describe("scanTags", () => {
  it("タグを検出し表示テキストから除去する", () => {
    const r = scanTags("これで作れます\n[READY_TO_GENERATE]");
    expect(r.readyToGenerate).toBe(true);
    expect(r.cleaned).toBe("これで作れます");
  });
  it("タグ無しはそのまま", () => {
    const r = scanTags("質問です");
    expect(r.readyToGenerate).toBe(false);
    expect(r.cleaned).toBe("質問です");
  });
});

describe("nextPhase", () => {
  it("READY_TO_GENERATE は最優先で dsl へ", () => {
    expect(nextPhase("hearing", scanTags("x[READY_TO_GENERATE]"))).toBe("dsl");
  });
  it("hearing→outline は READY_FOR_OUTLINE", () => {
    expect(nextPhase("hearing", scanTags("x[READY_FOR_OUTLINE]"))).toBe("outline");
  });
  it("outline→dsl は OUTLINE_READY", () => {
    expect(nextPhase("outline", scanTags("x[OUTLINE_READY]"))).toBe("dsl");
  });
  it("タグ無しは現状維持", () => {
    expect(nextPhase("hearing", scanTags("x"))).toBe("hearing");
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

describe("trimHistory / stripFences", () => {
  it("直近Nターンに絞る", () => {
    const msgs: Message[] = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: String(i) }));
    expect(trimHistory(msgs, 10)).toHaveLength(10);
    expect(trimHistory(msgs, 10)[0].content).toBe("20");
  });
  it("フェンス記号を除去", () => {
    expect(stripFences("```\nslide title\n```")).toBe("slide title");
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
});
