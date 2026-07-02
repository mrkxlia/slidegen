// @vitest-environment jsdom
// ビュー層の回帰ガード（プロパティ駆動・api/worker はモックしない）。
// 重い e2e(Playwright) は opt-in のまま。ここは CI の vitest で動く軽量テスト。
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TopBar, ConversationPane, DeckPane } from "../src/components";

// jsdom は scrollIntoView 未実装（ConversationPane の useEffect が呼ぶ）。
beforeAll(() => {
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
});
// globals 無効のため RTL の自動クリーンアップが登録されない。明示的に行う。
afterEach(cleanup);

function convProps(over: Record<string, unknown> = {}) {
  return {
    messages: [], phase: "hearing", input: "", onInput: vi.fn(), onSend: vi.fn(), onStop: vi.fn(),
    onMakeOutline: vi.fn(), onGenerate: vi.fn(), busy: false, modelId: "m1", hasDsl: false,
    purposes: ["（選択してください）", "社内報告", "承認を得る提案"], purpose: "（選択してください）",
    onPurposeChange: vi.fn(), examples: ["来月の経営会議で承認を得たい"], onExample: vi.fn(),
    attachments: [], onFiles: vi.fn(), onRemoveAttachment: vi.fn(), onImportDeck: vi.fn(), ...over,
  } as never;
}

function deckProps(over: Record<string, unknown> = {}) {
  return {
    tab: "preview", onTab: vi.fn(), dsl: "", onDslChange: vi.fn(), dslValid: false,
    preview: null, previewing: false, onPreview: vi.fn(), onRender: vi.fn(), rendering: false,
    renderStage: "idle", hasTemplate: false, onReview: vi.fn(), reviewText: "", onApplyReview: vi.fn(),
    canApplyReview: false, busy: false, genRunning: false, generatingModel: "M1", genNotice: null,
    genFailedRaw: null, error: null, onRegenerate: vi.fn(), deckCount: 0, ...over,
  } as never;
}

describe("TopBar", () => {
  it("ワードマーク・進行ステップ・モデルを表示し、⚙ で設定トグルを呼ぶ", () => {
    const onToggleSettings = vi.fn();
    render(<TopBar phase={"dsl" as never} models={[{ id: "m1", label: "Model One", tier: "free" }] as never}
      modelId="m1" onModelChange={vi.fn()} settingsOpen={false} onToggleSettings={onToggleSettings} />);
    expect(screen.getByText("slidegen")).toBeInTheDocument();
    expect(screen.getByText("DSL生成")).toBeInTheDocument();
    expect(screen.getByText("Model One")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    expect(onToggleSettings).toHaveBeenCalledOnce();
  });
});

describe("ConversationPane（オンボーディング空状態）", () => {
  it("目的チップと依頼例を出し、プレースホルダ目的は除外する", () => {
    render(<ConversationPane {...convProps()} />);
    expect(screen.getByRole("button", { name: "社内報告" })).toBeInTheDocument();
    expect(screen.queryByText("（選択してください）")).not.toBeInTheDocument();
    expect(screen.getByText("来月の経営会議で承認を得たい")).toBeInTheDocument();
  });
  it("依頼例クリックで onExample、チップクリックで onPurposeChange を呼ぶ", () => {
    const onExample = vi.fn();
    const onPurposeChange = vi.fn();
    render(<ConversationPane {...convProps({ onExample, onPurposeChange })} />);
    fireEvent.click(screen.getByText("来月の経営会議で承認を得たい"));
    expect(onExample).toHaveBeenCalledWith("来月の経営会議で承認を得たい");
    fireEvent.click(screen.getByRole("button", { name: "承認を得る提案" }));
    expect(onPurposeChange).toHaveBeenCalledWith("承認を得る提案");
  });
  it("デザイン取り込みカードを出し、.pptx 選択で onImportDeck を呼ぶ", () => {
    const onImportDeck = vi.fn();
    const { container } = render(<ConversationPane {...convProps({ onImportDeck })} />);
    const card = screen.getByRole("button", { name: /既存の pptx を取り込んで作り直す/ });
    expect(card).toBeInTheDocument();
    expect(screen.getByText(/型に再構成されます/)).toBeInTheDocument(); // 完全再現でない旨の注記
    const input = container.querySelector('input[accept=".pptx"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "deck.pptx")] } });
    expect(onImportDeck).toHaveBeenCalledOnce();
  });
  it("モデル未選択時は取り込みカードが disabled", () => {
    render(<ConversationPane {...convProps({ modelId: "" })} />);
    expect(screen.getByRole("button", { name: /既存の pptx を取り込んで作り直す/ })).toBeDisabled();
  });
  it("busy 中は『停止』ボタンを出し、クリックで onStop を呼ぶ", () => {
    const onStop = vi.fn();
    render(<ConversationPane {...convProps({ busy: true, messages: [{ role: "user", content: "hi" }], onStop })} />);
    const stop = screen.getByRole("button", { name: "停止" });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /送信/ })).not.toBeInTheDocument();
  });
});

describe("DeckPane（状態分岐）", () => {
  it("空デッキはゴーストスライドを表示", () => {
    render(<DeckPane {...deckProps()} />);
    expect(screen.getByText("ここにスライドが生まれます")).toBeInTheDocument();
  });
  it("生成中は進捗のみ（生出力は出さない）", () => {
    render(<DeckPane {...deckProps({ genRunning: true })} />);
    expect(screen.getByText(/スライドを生成しています/)).toBeInTheDocument();
  });
  it("無効DSL時は再生成導線を出し、クリックで onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(<DeckPane {...deckProps({ genFailedRaw: "}}}}", error: "失敗", onRegenerate })} />);
    fireEvent.click(screen.getByRole("button", { name: "もう一度生成" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
  it("構成プレビューは {強調} をハイライト化し、波括弧を残さない", () => {
    const preview = [{ type: "title", headline: "新基盤で {重大障害を1/3} に", kicker: "", foot: "", columns: [], blocks: [] }];
    render(<DeckPane {...deckProps({ dsl: "slide title", dslValid: true, preview })} />);
    expect(screen.getByText("重大障害を1/3")).toBeInTheDocument();      // 強調語が span 化されて存在
    expect(screen.queryByText(/\{重大障害/)).not.toBeInTheDocument();   // 波括弧は残さない
    expect(screen.getByRole("button", { name: /PowerPoint を生成/ })).toBeInTheDocument();
  });
});
