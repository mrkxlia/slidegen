// App.tsx — slidegen フロントエンドのオーケストレーション。
// 壁打ち→流れ→DSL→生成のフェーズ駆動。LLM は gateway 経由、pptx 生成はブラウザ Pyodide。
import { useEffect, useRef, useState } from "react";
import { PURPOSES, phaseSystemPrompt, buildContextPreamble, type Phase } from "./prompts";
import {
  scanTags, extractFencedDsl, stripToDsl, stripReasoning, hasValidDsl, trimHistory,
  type Message,
} from "./phases";
import { ingest, type IngestResult } from "./ingest";
import * as api from "./api";
import {
  initRenderer, renderDsl, previewDsl, downloadPptx,
  type RenderStage, type TemplateFile, type SlidePreview,
} from "./render/renderClient";
import { loadSettings, saveSettings } from "./storage";
import { PhaseBar, ChatView, Sidebar, DslPanel, RenderOverlay } from "./components";

export function App() {
  const saved = loadSettings();
  const [models, setModels] = useState<api.ModelInfo[]>([]);
  const [modelId, setModelId] = useState(saved.modelId ?? "");
  const [purpose, setPurpose] = useState(saved.purpose ?? PURPOSES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("hearing");
  const [attachments, setAttachments] = useState<IngestResult[]>([]);
  const [template, setTemplate] = useState<TemplateFile | null>(null);
  const [dslText, setDslText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [preview, setPreview] = useState<SlidePreview[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [genRunning, setGenRunning] = useState(false); // DSL生成中（進捗カード表示用）
  const [genFailedRaw, setGenFailedRaw] = useState<string | null>(null); // 無効DSL時の生出力
  const [rendering, setRendering] = useState(false);
  const [renderStage, setRenderStage] = useState<RenderStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const contextInjected = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 新メッセージで内部スクロール領域を最下部へ（ページではなくチャット枠が内部スクロールするため必須）。
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    api.fetchModels()
      .then((ms) => {
        setModels(ms);
        // 保存済みモデルが利用可能ならそれを、無ければ先頭を選ぶ
        setModelId((cur) => (ms.some((m) => m.id === cur) ? cur : ms[0]?.id ?? ""));
      })
      .catch(handleApiError);
  }, []);

  // 設定の永続化
  useEffect(() => { saveSettings({ modelId, purpose }); }, [modelId, purpose]);

  function handleApiError(e: unknown) {
    if (e instanceof api.AuthExpiredError) { setAuthExpired(true); return; }
    setError((e as Error).message);
  }

  const attachmentsSummary = () => attachments.map((a) => a.summary).join("\n\n");
  const purposeText = () => (purpose.startsWith("（") ? "" : purpose);

  // 現フェーズの system + (必要なら)文脈 + トリミング履歴を組み立てる。
  function prepare(p: Phase, baseMsgs: Message[], forceContext = false): { system: string; messages: Message[] } {
    let system = phaseSystemPrompt(p);
    if ((p === "hearing" || p === "outline") && dslText.trim()) {
      system += "\n\n## 補足: すでにスライドが一度生成されています。" +
        "ユーザーの発言は基本的に既存スライドへの修正・追記の依頼として扱い、" +
        "最初から全項目を聞き直さない。必要な確認だけ簡潔に行い、" +
        "準備ができたら [READY_TO_GENERATE] を出す。";
    }
    let msgs = trimHistory(baseMsgs);
    if (forceContext || !contextInjected.current) {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      if (preamble) msgs = [{ role: "user", content: preamble }, ...msgs];
      contextInjected.current = true;
    }
    return { system, messages: msgs };
  }

  // ストリーミングで assistant 応答を受け取り、最後の assistant メッセージへ逐次反映。
  // 返り値は raw 全文（タグ込み）。
  async function streamAssistant(p: Phase, baseMsgs: Message[], forceContext = false): Promise<string> {
    const { system, messages: msgs } = prepare(p, baseMsgs, forceContext);
    setMessages([...baseMsgs, { role: "assistant", content: "" }]);
    const res = await api.chatStream({ modelId, system, messages: msgs }, (_d, full) => {
      // タグは表示前に除去（生成途中で一瞬見えるのを防ぐ）
      const shown = scanTags(full).cleaned;
      setMessages([...baseMsgs, { role: "assistant", content: shown || "▍" }]);
    });
    return res.text;
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy || !modelId) return;
    setError(null);
    const newMsgs = [...messages, { role: "user", content: text } as Message];
    setMessages(newMsgs);
    setInput("");
    setBusy(true);
    try {
      // 手動進行: AI は壁打ち中に自動で次フェーズへ進まない（タグは表示用に除去するだけ）。
      // 進行はユーザーが「流れを作る →」「今ある情報で生成 →」を押したときだけ。
      const raw = await streamAssistant(phase, newMsgs);
      setMessages([...newMsgs, { role: "assistant", content: scanTags(raw).cleaned } as Message]);
    } catch (e) { handleApiError(e); }
    finally { setBusy(false); }
  }

  // 「流れを作る →」: ユーザー操作で outline フェーズに進み、流れ案を出す。
  async function onMakeOutline() {
    if (busy || !modelId || messages.length === 0) return;
    setError(null);
    setPhase("outline");
    setBusy(true);
    await autoOutline(messages);
    setBusy(false);
  }

  // outline フェーズに入ったら、すぐ流れ案を出す。
  async function autoOutline(history: Message[]) {
    try {
      const raw = await streamAssistant("outline", history, true);
      setMessages([...history, { role: "assistant", content: scanTags(raw).cleaned }]);
    } catch (e) { handleApiError(e); }
  }

  // 今ある情報で生成（既存DSLがあれば revise、無ければ dsl 生成）。
  // 生成中は「進捗のみ」表示にし、途中の生出力（劣化モデルの `}` 連発等）は見せない。
  // 完了時に DSL として妥当か検証し、妥当なときだけエディタへ反映する。
  async function generateNow(history?: Message[]) {
    const hist = history ?? messages;
    const hasContext = hist.length > 0 || attachments.length > 0 || purposeText() !== "";
    if (!hasContext) { setError("先に内容を入力するか、目的の選択・ファイル添付をしてください。"); return; }
    setBusy(true);
    setGenRunning(true);
    setError(null);
    setGenFailedRaw(null);
    setReviewText("");
    const existing = dslText.trim();
    setPhase("dsl");
    setDslText("");
    try {
      let system: string;
      let messages: Message[];
      if (existing) {
        const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
        const head = (preamble ? preamble + "\n\n" : "") + "【現在のDSL（これをベースに更新）】\n" + existing;
        system = phaseSystemPrompt("revise");
        messages = [{ role: "user", content: head }, ...trimHistory(hist)];
      } else {
        const prep = prepare("dsl", hist, true);
        system = prep.system; messages = prep.messages;
      }
      // onDelta は意図的に無視（生の途中出力をエディタに流さない）。進捗はスピナーで示す。
      const res = await api.chatStream({ modelId, system, messages }, () => {});
      const dsl = stripToDsl(res.text);
      if (hasValidDsl(dsl)) {
        setDslText(dsl);
      } else {
        // 劣化出力等で `slide <型>` 行が1つも無い → 反映せず、親切なエラー＋再生成導線。
        setGenFailedRaw(res.text);
        setError("AIが有効なDSLを生成できませんでした。別のモデルに変えるか、もう一度生成してください。");
      }
    } catch (e) { handleApiError(e); }
    finally { setGenRunning(false); setBusy(false); }
  }

  async function onReview() {
    if (!dslText.trim()) return;
    setBusy(true); setError(null);
    setReviewText("");
    try {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      const user = (preamble ? preamble + "\n\n" : "") + "次のDSLをレビューしてください:\n\n" + dslText;
      const res = await api.chatStream(
        { modelId, system: phaseSystemPrompt("review"), messages: [{ role: "user", content: user }] },
        (_d, full) => setReviewText(stripReasoning(full)),
      );
      setReviewText(stripReasoning(res.text));
    } catch (e) { handleApiError(e); }
    finally { setBusy(false); }
  }

  function applyReview() {
    const dsl = extractFencedDsl(reviewText);
    if (dsl) { setDslText(dsl); setReviewText(""); }
  }

  // DSL が `slide <型>` で始まる体裁か。preview/render 前にここで止め、
  // 無効テキストを Pyodide に渡して Python traceback を露出させない。
  function guardDsl(): boolean {
    if (hasValidDsl(dslText)) return true;
    setError("DSL が正しくありません。各スライドは行頭 `slide <型>`（例: slide title）から始まる必要があります。チャットで修正するか、もう一度生成してください。");
    return false;
  }

  async function onRender() {
    if (!dslText.trim() || !guardDsl()) return;
    setRendering(true); setError(null);
    try {
      await initRenderer(setRenderStage);
      const bytes = await renderDsl(dslText, template ?? undefined);
      downloadPptx(bytes);
    } catch (e) {
      // parse エラー等: 編集して再生成できるよう、編集画面に留めてエラー表示。
      setError(`生成に失敗しました: ${(e as Error).message}\nDSLを修正して再度お試しください。`);
    } finally { setRendering(false); }
  }

  async function onPreview() {
    if (!dslText.trim() || !guardDsl()) return;
    setPreviewing(true); setError(null);
    try {
      await initRenderer(setRenderStage);
      setPreview(await previewDsl(dslText));
    } catch (e) {
      setError(`プレビューに失敗しました: ${(e as Error).message}`);
    } finally { setPreviewing(false); }
  }

  async function onTemplate(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const bytes = await f.arrayBuffer();
    setTemplate({ name: f.name, bytes, byteLength: bytes.byteLength });
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const results: IngestResult[] = [];
    for (const f of Array.from(files)) results.push(await ingest(f));
    const byName = new Map(attachments.map((a) => [a.name, a]));
    for (const r of results) byName.set(r.name, r);
    setAttachments(Array.from(byName.values()));
    contextInjected.current = false; // 次回 LLM 呼び出しで添付を文脈へ
  }

  function onRemoveAttachment(name: string) {
    setAttachments(attachments.filter((a) => a.name !== name));
    contextInjected.current = false;
  }

  function onDslChange(v: string) { setDslText(v); setPreview(null); }

  function onReset() {
    setMessages([]); setPhase("hearing"); setDslText(""); setReviewText("");
    setAttachments([]); setPreview(null); setInput(""); setError(null);
    setGenFailedRaw(null); setGenRunning(false);
    contextInjected.current = false;
  }

  if (authExpired) {
    return (
      <div className="reauth">
        <h2>セッションが切れました</h2>
        <p>Cloudflare Access の再認証が必要です。</p>
        <button onClick={api.triggerReauth}>再ログイン</button>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar
        models={models} modelId={modelId} onModelChange={setModelId}
        purposes={PURPOSES} purpose={purpose} onPurposeChange={setPurpose}
        attachments={attachments} onFiles={onFiles}
        onRemoveAttachment={onRemoveAttachment}
        template={template} onTemplate={onTemplate}
        onClearTemplate={() => setTemplate(null)}
        onReset={onReset}
      />
      <main className="main">
        <header className="main-header">
          <div className="wordmark">
            <span className="wordmark-icon" aria-hidden="true">🪄</span>
            <span className="wordmark-name">slidegen</span>
            <span className="wordmark-tag">AIと壁打ちしてスライドを作る</span>
          </div>
          <PhaseBar phase={phase} />
        </header>

        <div className="main-body">
          {(phase === "hearing" || phase === "outline") && (
            <div className="chat-pane">
              <div className="chat-scroll">
                {dslText.trim() && (
                  <div className="info">✏️ 既存スライドの修正モード。直したい点を送って「今ある情報で生成」を押すと更新します。</div>
                )}
                <ChatView messages={messages} />
                <div ref={chatEndRef} />
              </div>
              {error && <div className="error">⚠ {error}</div>}
              <div className="composer">
                <textarea
                  placeholder={phase === "hearing"
                    ? "作りたいスライドについて教えてください（例：来月の経営会議で新監視基盤の導入承認を得たい）"
                    : "流れへの修正点や「これでOK」など"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }}
                />
                <div className="composer-actions">
                  <button onClick={onSend} disabled={busy || !modelId}>{busy ? "送信中…" : "送信 (⌘/Ctrl+Enter)"}</button>
                  {phase === "hearing" && (
                    <button className="ghost" onClick={onMakeOutline} disabled={busy || !modelId || messages.length === 0}>
                      流れを作る →
                    </button>
                  )}
                  <button className="ghost" onClick={() => generateNow()} disabled={busy || !modelId}>
                    今ある情報で生成 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {(phase === "dsl" || phase === "review" || phase === "revise") && (
            <div className="dsl-pane">
              <DslPanel
                dsl={dslText} onChange={onDslChange}
                onRender={onRender} onReview={onReview}
                onBackToChat={() => setPhase("hearing")}
                reviewText={reviewText}
                onApplyReview={applyReview}
                canApplyReview={!!extractFencedDsl(reviewText)}
                renderStage={renderStage} rendering={rendering}
                generating={busy} dslGenerating={genRunning}
                generatingModel={models.find((m) => m.id === modelId)?.label ?? modelId}
                onPreview={onPreview} previewing={previewing}
                preview={preview} hasTemplate={!!template}
              />
              {error && (
                <div className="error">
                  ⚠ {error}
                  {genFailedRaw != null && (
                    <div className="error-actions">
                      <button onClick={() => generateNow()} disabled={busy || !modelId}>もう一度生成</button>
                      <details>
                        <summary>生成結果を表示（デバッグ）</summary>
                        <pre>{genFailedRaw}</pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <RenderOverlay stage={renderStage} rendering={rendering} />
    </div>
  );
}
