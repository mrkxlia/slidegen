// App.tsx — slidegen フロントエンドのオーケストレーション（会話起点ワークスペース）。
// 左で壁打ち、右でデッキ（構成プレビュー/DSL/レビュー）が同時に育つ2ペイン。
// フェーズは上部の進行ステッパー。LLM は gateway 経由、pptx 生成はブラウザ Pyodide。
import { useEffect, useRef, useState } from "react";
import { PURPOSES, phaseSystemPrompt, buildContextPreamble, IMPORT_DECK_SYSTEM, type Phase } from "./prompts";
import {
  cleanReply, extractFencedDsl, stripToDsl, stripReasoning, hasValidDsl, trimHistory, pickDslFallback,
  type Message,
} from "./phases";
import { ingest, type IngestResult } from "./ingest";
import { MAX_IMAGES_PER_REQUEST } from "./image";
import * as api from "./api";
import {
  initRenderer, renderDsl, previewDsl, inspectPptx, downloadPptx, terminateRenderer,
  CanceledError as RenderCanceledError,
  type RenderStage, type TemplateFile, type SlidePreview,
} from "./render/renderClient";
import { loadSettings, saveSettings } from "./storage";
import {
  TopBar, SettingsPopover, MobileTabs, ConversationPane, DeckPane, RenderOverlay,
  type DeckTab,
} from "./components";

// AIが空応答を返したとき（全モデル空 or タグ/空白のみ）に共通で出す文言。
const EMPTY_MSG = "AIが空の応答を返しました。モデルを変えるか、もう一度お試しください。";

// オンボーディングの依頼例（クリックで入力欄へ）。
const EXAMPLES = [
  "来月の経営会議で、新しい監視基盤の導入承認を得たい。",
  "先月の売上データ（添付Excel）を、役員向けに3枚で。",
  "新機能の社内勉強会の資料を作りたい。",
];

export function App() {
  const saved = loadSettings();
  const [models, setModels] = useState<api.ModelInfo[]>([]);
  const [modelId, setModelId] = useState(saved.modelId ?? "");
  const [purpose, setPurpose] = useState(saved.purpose ?? PURPOSES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>("hearing");
  const [attachments, setAttachments] = useState<IngestResult[]>([]);
  const [template, setTemplate] = useState<TemplateFile | null>(null);
  // デザイン取り込み: 既存 pptx の構造スペック（セッション限り・永続化しない）。
  const [importedDeck, setImportedDeck] = useState<{ name: string; spec: string } | null>(null);
  const [dslText, setDslText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [preview, setPreview] = useState<SlidePreview[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [genRunning, setGenRunning] = useState(false); // DSL生成中（進捗カード表示用）
  const [genFailedRaw, setGenFailedRaw] = useState<string | null>(null); // 無効DSL時の生出力
  const [genNotice, setGenNotice] = useState<string | null>(null); // 自動フォールバック等の通知
  const [rendering, setRendering] = useState(false);
  const [renderStage, setRenderStage] = useState<RenderStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  // ビュー状態（ロジックには影響しない）
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deckTab, setDeckTab] = useState<DeckTab>("preview");
  const [mobileView, setMobileView] = useState<"talk" | "deck">("talk");
  const contextInjected = useRef(false);
  const abortRef = useRef<AbortController | null>(null); // 進行中の chatStream を停止ボタンで中断する

  useEffect(() => {
    api.fetchModels()
      .then((ms) => {
        setModels(ms);
        setModelId((cur) => (ms.some((m) => m.id === cur) ? cur : ms[0]?.id ?? ""));
      })
      .catch(handleApiError);
  }, []);

  useEffect(() => { saveSettings({ modelId, purpose }); }, [modelId, purpose]);

  function handleApiError(e: unknown) {
    if (e instanceof api.AuthExpiredError) { setAuthExpired(true); return; }
    if (e instanceof api.CanceledError) { setError(null); return; } // 停止は静かに中断
    if (e instanceof api.ApiError && e.code === "empty") { setError(EMPTY_MSG); return; }
    setError((e as Error).message);
  }

  const attachmentsSummary = () => attachments.map((a) => a.summary).join("\n\n");
  const purposeText = () => (purpose.startsWith("（") ? "" : purpose);
  const labelOf = (id: string) => models.find((m) => m.id === id)?.label ?? id;
  const deckCount = dslText.trim() ? (dslText.match(/^slide\s+\S+/gm)?.length ?? 0) : 0;

  // 選択モデルが vision 対応のときだけ、添付画像（縮小済み base64）を返す。
  // 非対応モデルには載せない（summary テキストのみ＝従来動作）。gateway 側でも二重に防御される。
  const visionImages = () => {
    if (models.find((m) => m.id === modelId)?.vision !== true) return undefined;
    const imgs = attachments
      .filter((a) => a.imageData && a.mimeType)
      .slice(0, MAX_IMAGES_PER_REQUEST)
      .map((a) => ({ mimeType: a.mimeType!, data: a.imageData! }));
    return imgs.length ? imgs : undefined;
  };

  // 現フェーズの system + (必要なら)文脈 + トリミング履歴を組み立てる。
  function prepare(
    p: Phase, baseMsgs: Message[], forceContext = false,
  ): { system: string; messages: Message[]; commitContext: () => void } {
    let system = phaseSystemPrompt(p);
    if ((p === "hearing" || p === "outline") && dslText.trim()) {
      system += "\n\n## 補足: すでにスライドが一度生成されています。" +
        "ユーザーの発言は基本的に既存スライドへの修正・追記の依頼として扱い、" +
        "最初から全項目を聞き直さない。必要な確認だけ簡潔に行う" +
        "（生成へ進むかはユーザーがボタンで判断する）。";
    }
    let msgs = trimHistory(baseMsgs);
    let injectedNow = false;
    if (forceContext || !contextInjected.current) {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      if (preamble) msgs = [{ role: "user", content: preamble, images: visionImages() }, ...msgs];
      injectedNow = true;
    }
    // 実際に送信が成功するまでは確定させない（呼び出し側が commitContext() を呼ぶ）。
    // 送信失敗/中断時にここで true 化すると、以後プリアンブルが無言で欠落し続けるため。
    return { system, messages: msgs, commitContext: () => { if (injectedNow) contextInjected.current = true; } };
  }

  // ストリーミングで assistant 応答を受け取り、最後の assistant メッセージへ逐次反映。
  async function streamAssistant(p: Phase, baseMsgs: Message[], forceContext = false): Promise<string> {
    const { system, messages: msgs, commitContext } = prepare(p, baseMsgs, forceContext);
    const ac = new AbortController();
    abortRef.current = ac;
    setMessages([...baseMsgs, { role: "assistant", content: "▍" }]); // 初手で「考え中」を見せる
    try {
      const res = await api.chatStream({ modelId, system, messages: msgs }, (_d, full) => {
        const shown = cleanReply(full);
        setMessages([...baseMsgs, { role: "assistant", content: shown || "▍" }]);
      }, { signal: ac.signal });
      commitContext(); // 送信成功後にのみ確定（失敗/中断時は次回また文脈を注入する）
      return res.text;
    } finally { abortRef.current = null; }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy || !modelId) return;
    setError(null);
    const newMsgs = [...messages, { role: "user", content: text } as Message];
    setMessages(newMsgs);
    setInput("");
    setBusy(true);
    // 会話の system は壁打ち/流れのみ。生成後(dsl/review/revise)に送られたら壁打ちとして継続。
    const convPhase: Phase = phase === "outline" ? "outline" : "hearing";
    try {
      const raw = await streamAssistant(convPhase, newMsgs);
      const reply = cleanReply(raw);
      // タグ/空白のみで実質空になったら、空バブルを残さず再送を促す。
      if (!reply) { setMessages(newMsgs); setError(EMPTY_MSG); return; }
      setMessages([...newMsgs, { role: "assistant", content: reply } as Message]);
    } catch (e) {
      setMessages(newMsgs); // 失敗/中断時はプレースホルダを巻き戻す
      handleApiError(e);
    }
    finally { setBusy(false); }
  }

  // 「流れを作る →」: outline フェーズに進み、流れ案を出す。
  async function onMakeOutline() {
    if (busy || !modelId || messages.length === 0) return;
    setError(null);
    const prevPhase = phase;
    setPhase("outline");
    setBusy(true);
    try {
      const raw = await streamAssistant("outline", messages, true);
      const reply = cleanReply(raw);
      if (!reply) { setMessages(messages); setPhase(prevPhase); setError(EMPTY_MSG); return; }
      setMessages([...messages, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(messages); // 失敗/中断時はプレースホルダを巻き戻す
      setPhase(prevPhase); // outline に進めたことも取り消す（流れ案が実際には無い状態のため）
      handleApiError(e);
    }
    finally { setBusy(false); }
  }

  // 今ある情報で生成（既存DSLがあれば revise、取り込みデッキがあれば import、無ければ dsl 生成）。
  async function generateNow(history?: Message[], deck?: { name: string; spec: string }) {
    const hist = history ?? messages;
    const importDeck = deck ?? importedDeck;
    const hasContext = hist.length > 0 || attachments.length > 0 || purposeText() !== "" || !!importDeck;
    if (!hasContext) { setError("先に内容を入力するか、目的の選択・ファイル添付をしてください。"); return; }
    setBusy(true);
    setGenRunning(true);
    setError(null);
    setGenFailedRaw(null);
    setGenNotice(null);
    setReviewText("");
    const existing = dslText.trim();
    setPhase("dsl");
    setDslText("");
    setPreview(null);
    setDeckTab("preview");
    setMobileView("deck"); // モバイルでは結果（デッキ）に切替
    try {
      let system: string;
      let messages: Message[];
      let commitContext = () => {};
      if (existing) {
        const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
        const head = (preamble ? preamble + "\n\n" : "") + "【現在のDSL（これをベースに更新）】\n" + existing;
        system = phaseSystemPrompt("revise");
        messages = [{ role: "user", content: head, images: visionImages() }, ...trimHistory(hist)];
      } else if (importDeck) {
        // デザイン取り込み: 構造スペックから DSL を再構成（revise と同じく user 先頭に文脈を置く）。
        const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
        const head = (preamble ? preamble + "\n\n" : "") +
          `【取り込んだ既存デッキ「${importDeck.name}」の構造スペック】\n` + importDeck.spec;
        system = IMPORT_DECK_SYSTEM;
        messages = [{ role: "user", content: head, images: visionImages() }, ...trimHistory(hist)];
      } else {
        const prep = prepare("dsl", hist, true);
        system = prep.system; messages = prep.messages; commitContext = prep.commitContext;
      }
      const chain = [modelId, pickDslFallback(models, modelId)].filter((id): id is string => !!id);
      const ac = new AbortController();
      abortRef.current = ac;
      let lastRaw = "";
      for (let i = 0; i < chain.length; i++) {
        let res: { text: string };
        try {
          res = await api.chatStream({ modelId: chain[i], system, messages }, () => {}, { signal: ac.signal });
          commitContext(); // 送信成功後にのみ確定（全候補失敗時は次回また文脈を注入する）
        } catch (e) {
          if (e instanceof api.CanceledError) throw e; // 停止は即中断（次候補を試さない）
          handleApiError(e); // 空/タイムアウト等はバナーに反映しつつ次の reliable モデルへ
          continue;
        }
        const dsl = stripToDsl(res.text);
        if (hasValidDsl(dsl)) {
          setDslText(dsl);
          if (i > 0) {
            setGenNotice(`「${labelOf(modelId)}」が有効なDSLを出せなかったため、「${labelOf(chain[i])}」で生成しました。`);
          }
          setError(null); // 途中候補の失敗で出たバナーは成功時にクリア
          setGenRunning(false);
          void runPreview(dsl); // 生成できたら構成プレビューを自動表示
          return;
        }
        lastRaw = res.text;
      }
      if (lastRaw) setGenFailedRaw(lastRaw);
      setError("AIが有効なDSLを生成できませんでした。別のモデルに変えるか、もう一度生成してください。");
    } catch (e) { handleApiError(e); }
    finally { setGenRunning(false); setBusy(false); abortRef.current = null; }
  }

  async function onReview() {
    if (!dslText.trim()) return;
    setBusy(true); setReviewing(true); setError(null);
    setReviewText("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const preamble = buildContextPreamble(purposeText(), attachmentsSummary());
      const user = (preamble ? preamble + "\n\n" : "") + "次のDSLをレビューしてください:\n\n" + dslText;
      const res = await api.chatStream(
        { modelId, system: phaseSystemPrompt("review"), messages: [{ role: "user", content: user, images: visionImages() }] },
        (_d, full) => setReviewText(stripReasoning(full)),
        { signal: ac.signal },
      );
      setReviewText(stripReasoning(res.text));
    } catch (e) {
      setReviewText(""); // 失敗/中断時は途中までのレビュー文を残さない（完了したかのように見えるのを防ぐ）
      handleApiError(e);
    }
    finally { setBusy(false); setReviewing(false); abortRef.current = null; }
  }

  // 進行中の生成/応答を停止する（停止ボタン）。
  function onStop() { abortRef.current?.abort(); }

  function applyReview() {
    const dsl = extractFencedDsl(reviewText);
    if (dsl) { setDslText(dsl); setReviewText(""); setPreview(null); setDeckTab("preview"); }
  }

  // DSL が `slide <型>` で始まる体裁か。preview/render 前にここで止める。
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
      // ユーザーによるキャンセルは onCancelRender 側で既にメッセージ表示済み。ここで上書きしない。
      if (e instanceof RenderCanceledError) return;
      setError(`生成に失敗しました: ${(e as Error).message}\nDSLを修正して再度お試しください。`);
    } finally { setRendering(false); }
  }

  // レンダ/プレビュー/取り込み中のオーバーレイからのキャンセル。
  // worker を強制終了する（renderClient 側で次回呼び出し時に自動的に作り直される）。
  function onCancelRender() {
    terminateRenderer("ユーザーがキャンセルしました");
    setRendering(false);
    setPreviewing(false);
    setError("処理をキャンセルしました。");
  }

  // 与えた DSL（無ければ現在の dslText）の構成プレビューを取得。
  async function runPreview(dslArg?: string) {
    const text = dslArg ?? dslText;
    if (!text.trim() || !hasValidDsl(text)) return;
    setPreviewing(true); setError(null);
    try {
      await initRenderer(setRenderStage);
      setPreview(await previewDsl(text));
    } catch (e) {
      if (e instanceof RenderCanceledError) return;
      setError(`プレビューに失敗しました: ${(e as Error).message}`);
    } finally { setPreviewing(false); }
  }

  function onPreview() { if (!previewing && guardDsl()) void runPreview(); }

  // デッキのタブ切替。構成プレビューを開いた時、未取得なら自動で読み込む。
  function onDeckTab(t: DeckTab) {
    setDeckTab(t);
    if (t === "preview" && !preview && !previewing && hasValidDsl(dslText)) void runPreview();
  }

  async function onTemplate(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const bytes = await f.arrayBuffer();
    setTemplate({ name: f.name, bytes, byteLength: bytes.byteLength });
  }

  // デザイン取り込み: 既存 pptx をブラウザ内 Pyodide で構造抽出 → DSL 下書きを自動生成。
  async function onImportDeck(files: FileList | null) {
    const f = files?.[0];
    if (!f || busy || !modelId) return;
    setError(null);
    setRendering(true); // Pyodide 初回ブートの進捗をオーバーレイで見せる
    let deck: { name: string; spec: string };
    try {
      await initRenderer(setRenderStage);
      const bytes = await f.arrayBuffer();
      const spec = await inspectPptx({ name: f.name, bytes, byteLength: bytes.byteLength });
      deck = { name: f.name, spec };
    } catch (e) {
      if (e instanceof RenderCanceledError) return;
      setError(`取り込みに失敗しました: ${(e as Error).message}`);
      return;
    } finally { setRendering(false); }
    setImportedDeck(deck);
    const notice = `「${f.name}」を取り込みました。構造を解析して DSL の下書きを生成します` +
      "（デザインは slidegen の型への再構成になります）。";
    const newMsgs = [...messages, { role: "assistant", content: notice } as Message];
    setMessages(newMsgs);
    await generateNow(newMsgs, deck);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const results: IngestResult[] = [];
    for (const f of Array.from(files)) results.push(await ingest(f));
    const byName = new Map(attachments.map((a) => [a.name, a]));
    for (const r of results) byName.set(r.name, r);
    setAttachments(Array.from(byName.values()));
    contextInjected.current = false;
  }

  function onRemoveAttachment(name: string) {
    setAttachments(attachments.filter((a) => a.name !== name));
    contextInjected.current = false;
  }

  function onDslChange(v: string) { setDslText(v); setPreview(null); }

  function onReset() {
    setMessages([]); setPhase("hearing"); setDslText(""); setReviewText("");
    setAttachments([]); setImportedDeck(null); setPreview(null); setInput(""); setError(null);
    setGenFailedRaw(null); setGenRunning(false); setGenNotice(null);
    setDeckTab("preview"); setMobileView("talk"); setSettingsOpen(false);
    contextInjected.current = false;
  }

  if (authExpired) {
    return (
      <div className="reauth">
        <h2>セッションが切れました</h2>
        <p>Cloudflare Access の再認証が必要です。</p>
        <button className="btn" onClick={api.triggerReauth}>再ログイン</button>
      </div>
    );
  }

  const hasProdHint = !models.some((m) => m.tier === "prod");

  return (
    <div className="app" data-mobile={mobileView}>
      <TopBar
        phase={phase} models={models} modelId={modelId} onModelChange={setModelId}
        settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((v) => !v)}
      />
      {settingsOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 39 }} onClick={() => setSettingsOpen(false)} />
          <SettingsPopover
            purposes={PURPOSES} purpose={purpose} onPurposeChange={setPurpose}
            attachments={attachments} onFiles={onFiles} onRemoveAttachment={onRemoveAttachment}
            template={template} onTemplate={onTemplate} onClearTemplate={() => setTemplate(null)}
            onReset={onReset} hasProdHint={hasProdHint}
          />
        </>
      )}

      <MobileTabs view={mobileView} onView={setMobileView} deckCount={deckCount} />

      {error && genFailedRaw == null && (
        <div className="error" style={{ margin: "10px 16px" }}>⚠ {error}</div>
      )}

      <div className="workspace">
        <ConversationPane
          messages={messages} phase={phase}
          input={input} onInput={setInput} onSend={onSend} onStop={onStop}
          onMakeOutline={onMakeOutline} onGenerate={() => generateNow()}
          busy={busy} modelId={modelId} hasDsl={!!dslText.trim()}
          purposes={PURPOSES} purpose={purpose} onPurposeChange={setPurpose}
          examples={EXAMPLES} onExample={(t) => setInput(t)}
          attachments={attachments} onFiles={onFiles} onRemoveAttachment={onRemoveAttachment}
          onImportDeck={onImportDeck}
        />
        <DeckPane
          tab={deckTab} onTab={onDeckTab}
          dsl={dslText} onDslChange={onDslChange} dslValid={hasValidDsl(dslText)}
          preview={preview} previewing={previewing} onPreview={onPreview}
          onRender={onRender} rendering={rendering} renderStage={renderStage} hasTemplate={!!template}
          onReview={onReview} reviewText={reviewText} reviewing={reviewing} onApplyReview={applyReview}
          canApplyReview={!!extractFencedDsl(reviewText)}
          busy={busy} genRunning={genRunning} generatingModel={labelOf(modelId)}
          genNotice={genNotice} genFailedRaw={genFailedRaw} error={error}
          onRegenerate={() => generateNow()} deckCount={deckCount}
        />
      </div>

      <RenderOverlay stage={renderStage} rendering={rendering} onCancel={onCancelRender} />
    </div>
  );
}
