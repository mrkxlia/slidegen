// App.tsx — slidegen フロントエンドのオーケストレーション。
// 壁打ち→流れ→DSL→生成のフェーズ駆動。LLM は gateway 経由、pptx 生成はブラウザ Pyodide。
import { useEffect, useRef, useState } from "react";
import { PURPOSES, phaseSystemPrompt, buildContextPreamble, type Phase } from "./prompts";
import {
  scanTags, nextPhase, extractFencedDsl, stripFences, trimHistory,
  type Message,
} from "./phases";
import { ingest, type IngestResult } from "./ingest";
import * as api from "./api";
import { initRenderer, renderDsl, downloadPptx, type RenderStage } from "./render/renderClient";
import { PhaseBar, ChatView, Sidebar, DslPanel } from "./components";

export function App() {
  const [models, setModels] = useState<api.ModelInfo[]>([]);
  const [modelId, setModelId] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("hearing");
  const [attachments, setAttachments] = useState<IngestResult[]>([]);
  const [dslText, setDslText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderStage, setRenderStage] = useState<RenderStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const contextInjected = useRef(false);

  useEffect(() => {
    api.fetchModels()
      .then((ms) => { setModels(ms); if (ms.length) setModelId(ms[0].id); })
      .catch(handleApiError);
  }, []);

  function handleApiError(e: unknown) {
    if (e instanceof api.AuthExpiredError) { setAuthExpired(true); return; }
    setError((e as Error).message);
  }

  const attachmentsSummary = () => attachments.map((a) => a.summary).join("\n\n");
  const purposeText = () => (purpose.startsWith("（") ? "" : purpose);

  // 現フェーズの system + (必要なら)文脈 + トリミング履歴で LLM を呼ぶ。
  async function callLLM(p: Phase, forceContext = false): Promise<string> {
    let system = phaseSystemPrompt(p);
    if ((p === "hearing" || p === "outline") && dslText.trim()) {
      system += "\n\n## 補足: すでにスライドが一度生成されています。" +
        "ユーザーの発言は基本的に既存スライドへの修正・追記の依頼として扱い、" +
        "最初から全項目を聞き直さない。必要な確認だけ簡潔に行い、" +
        "準備ができたら [READY_TO_GENERATE] を出す。";
    }
    let msgs = trimHistory(messages);
    if (forceContext || !contextInjected.current) {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      if (preamble) msgs = [{ role: "user", content: preamble }, ...msgs];
      contextInjected.current = true;
    }
    const res = await api.chat({ modelId, system, messages: msgs });
    return res.text;
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy || !modelId) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setBusy(true);
    try {
      const raw = await callLLM(phase);
      const scan = scanTags(raw);
      setMessages([...newMsgs, { role: "assistant", content: scan.cleaned }]);
      const np = nextPhase(phase, scan);
      if (scan.readyToGenerate) {
        await generateNow(newMsgs);
      } else if (np !== phase) {
        setPhase(np);
        if (np === "outline") await autoOutline([...newMsgs, { role: "assistant", content: scan.cleaned }]);
      }
    } catch (e) { handleApiError(e); }
    finally { setBusy(false); }
  }

  // 流れフェーズに入ったら、すぐ流れ案を出す。
  async function autoOutline(history: Message[]) {
    try {
      const raw = await callLLM("outline", true);
      const scan = scanTags(raw);
      setMessages([...history, { role: "assistant", content: scan.cleaned }]);
    } catch (e) { handleApiError(e); }
  }

  // 今ある情報で生成（既存DSLがあれば revise、無ければ dsl 生成）。
  async function generateNow(history?: Message[]) {
    const hist = history ?? messages;
    const hasContext = hist.length > 0 || attachments.length > 0 || purposeText() !== "";
    if (!hasContext) { setError("先に内容を入力するか、目的の選択・ファイル添付をしてください。"); return; }
    setBusy(true);
    setError(null);
    try {
      const existing = dslText.trim();
      let dsl: string;
      if (existing) {
        const head = (() => {
          const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
          return (preamble ? preamble + "\n\n" : "") + "【現在のDSL（これをベースに更新）】\n" + existing;
        })();
        const res = await api.chat({
          modelId, system: phaseSystemPrompt("revise"),
          messages: [{ role: "user", content: head }, ...trimHistory(hist)],
        });
        dsl = res.text;
      } else {
        dsl = await callLLM("dsl", true);
      }
      setDslText(stripFences(dsl));
      setReviewText("");
      setPhase("dsl");
    } catch (e) { handleApiError(e); }
    finally { setBusy(false); }
  }

  async function onReview() {
    if (!dslText.trim()) return;
    setBusy(true); setError(null);
    try {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      const user = (preamble ? preamble + "\n\n" : "") + "次のDSLをレビューしてください:\n\n" + dslText;
      const res = await api.chat({
        modelId, system: phaseSystemPrompt("review"),
        messages: [{ role: "user", content: user }],
      });
      setReviewText(res.text);
    } catch (e) { handleApiError(e); }
    finally { setBusy(false); }
  }

  function applyReview() {
    const dsl = extractFencedDsl(reviewText);
    if (dsl) { setDslText(dsl); setReviewText(""); }
  }

  async function onRender() {
    if (!dslText.trim()) return;
    setRendering(true); setError(null);
    try {
      await initRenderer(setRenderStage);
      const bytes = await renderDsl(dslText);
      downloadPptx(bytes);
    } catch (e) {
      // parse エラー等: 編集して再生成できるよう、編集画面に留めてエラー表示。
      setError(`生成に失敗しました: ${(e as Error).message}\nDSLを修正して再度お試しください。`);
    } finally { setRendering(false); }
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

  function onReset() {
    setMessages([]); setPhase("hearing"); setDslText(""); setReviewText("");
    setAttachments([]); setInput(""); setError(null); contextInjected.current = false;
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
        attachments={attachments} onFiles={onFiles} onReset={onReset}
      />
      <main className="main">
        <h1>🪄 slidegen — AIと壁打ちしてスライドを作る</h1>
        <PhaseBar phase={phase} />

        {(phase === "hearing" || phase === "outline") && (
          <>
            {dslText.trim() && (
              <div className="info">✏️ 既存スライドの修正モード。直したい点を送って「今ある情報で生成」を押すと更新します。</div>
            )}
            <ChatView messages={messages} />
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
                <button className="ghost" onClick={() => generateNow()} disabled={busy || !modelId}>
                  今ある情報で生成 →
                </button>
              </div>
            </div>
          </>
        )}

        {(phase === "dsl" || phase === "review" || phase === "revise") && (
          <DslPanel
            dsl={dslText} onChange={setDslText}
            onRender={onRender} onReview={onReview}
            onBackToChat={() => setPhase("hearing")}
            reviewText={reviewText}
            onApplyReview={applyReview}
            canApplyReview={!!extractFencedDsl(reviewText)}
            renderStage={renderStage} rendering={rendering} error={null}
          />
        )}
        {(phase === "dsl") && error && <div className="error">⚠ {error}</div>}
      </main>
    </div>
  );
}
