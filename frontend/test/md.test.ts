import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/md";

describe("renderMarkdown", () => {
  it("HTML をエスケープして XSS を防ぐ", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("強調・コードを変換", () => {
    expect(renderMarkdown("**太字**")).toContain("<strong>太字</strong>");
    expect(renderMarkdown("`code`")).toContain("<code>code</code>");
  });
  it("番号リストを ol に", () => {
    const html = renderMarkdown("1. one\n2. two");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>one</li>");
  });
  it("見出しを h レベルに", () => {
    expect(renderMarkdown("# 見出し")).toContain("<h3>見出し</h3>");
  });
});
