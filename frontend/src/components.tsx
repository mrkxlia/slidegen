// components.tsx — 会話起点ワークスペースの表示用コンポーネント群（ロジックは App.tsx）。
import { useEffect, useRef } from "react";
import type { Phase } from "./prompts";
import type { Message } from "./phases";
import type { IngestResult } from "./ingest";
import type { ModelInfo } from "./api";
import type { RenderStage, TemplateFile, SlidePreview } from "./render/renderClient";
import { renderMarkdown } from "./md";

// 作成の進行ステップ（実工程の順序＝真のシーケンス）。
const PHASE_STEPS = ["壁打ち", "流れ", "DSL生成", "PowerPoint"];
function phaseIndex(phase: Phase): number {
  switch (phase) {
    case "hearing": return 0;
    case "outline": return 1;
    case "dsl":
    case "review":
    case "revise": return 2;
  }
}

// ── 上部バー: ワードマーク + 進行ステッパー + モデル + 設定 ──────────────
export function TopBar(props: {
  phase: Phase;
  models: ModelInfo[];
  modelId: string;
  onModelChange: (id: string) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  const active = phaseIndex(props.phase);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="glyph" aria-hidden="true" />
        <span className="wordmark-name">slidegen</span>
      </div>
      <ol className="steps" aria-label="作成の進行">
        {PHASE_STEPS.map((label, i) => {
          const state = i < active ? "done" : i === active ? "now" : "future";
          return (
            <li key={label} style={{ display: "contents" }}>
              {i > 0 && <span className="lk" aria-hidden="true" />}
              <span className={`step ${state}`} aria-current={state === "now" ? "step" : undefined}>
                <span className="dot">{i < active ? "✓" : i + 1}</span>
                <span className={`lbl${state === "now" ? " hl" : ""}`}>{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <span className="sp" />
      <select
        className="model-pill" aria-label="AIモデル"
        value={props.modelId} onChange={(e) => props.onModelChange(e.target.value)}
      >
        {props.models.length === 0 && <option value="">(利用可能モデルなし)</option>}
        {props.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <button
        className="icon-btn" aria-label="設定" aria-expanded={props.settingsOpen}
        onClick={props.onToggleSettings}
      >⚙</button>
    </header>
  );
}

// 設定（オンデマンド・ポップオーバー）: 目的 / 添付 / 会社テンプレ / リセット。
export function SettingsPopover(props: {
  purposes: string[];
  purpose: string;
  onPurposeChange: (p: string) => void;
  attachments: IngestResult[];
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (name: string) => void;
  template: TemplateFile | null;
  onTemplate: (files: FileList | null) => void;
  onClearTemplate: () => void;
  onReset: () => void;
  hasProdHint: boolean;
}) {
  return (
    <div className="settings-pop" role="dialog" aria-label="設定">
      <h3>スライドの主な目的</h3>
      <select value={props.purpose} onChange={(e) => props.onPurposeChange(e.target.value)}>
        {props.purposes.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <hr />
      <h3>添付ファイル</h3>
      <input type="file" multiple
        accept=".xlsx,.xls,.csv,.tsv,.pptx,.png,.jpg,.jpeg,.txt,.md"
        onChange={(e) => props.onFiles(e.target.files)} />
      {props.attachments.map((a) => (
        <p className="attach-row" key={a.name}>
          <span>✓ {a.name} … {a.kind}</span>
          <button className="link-btn" title="削除" onClick={() => props.onRemoveAttachment(a.name)}>×</button>
        </p>
      ))}

      <hr />
      <h3>会社テンプレート（任意）</h3>
      <small>.potx / .pptx を土台にして生成します。</small>
      <input type="file" accept=".potx,.pptx" onChange={(e) => props.onTemplate(e.target.files)} />
      {props.template && (
        <p className="tpl-row">
          <span>✓ {props.template.name}</span>
          <button className="link-btn" title="解除" onClick={props.onClearTemplate}>×</button>
        </p>
      )}

      <hr />
      <button className="btn ghost block" onClick={props.onReset}>会話をリセット</button>
      {props.hasProdHint && <small>本番モデルは gateway に API キー(secret)を設定すると表示されます。</small>}
    </div>
  );
}

// モバイル: 会話 / デッキ 切替。
export function MobileTabs(props: { view: "talk" | "deck"; onView: (v: "talk" | "deck") => void; deckCount: number }) {
  return (
    <div className="mobile-tabs" role="tablist" aria-label="表示の切替">
      <button role="tab" aria-selected={props.view === "talk"} className={props.view === "talk" ? "on" : ""}
        onClick={() => props.onView("talk")}>会話</button>
      <button role="tab" aria-selected={props.view === "deck"} className={props.view === "deck" ? "on" : ""}
        onClick={() => props.onView("deck")}>デッキ{props.deckCount > 0 ? `（${props.deckCount}）` : ""}</button>
    </div>
  );
}

function ChatView({ messages }: { messages: Message[] }) {
  return (
    <div className="chat">
      {messages.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          {m.role === "assistant"
            ? <div className="bubble">
                <div className="who">slidegen</div>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
              </div>
            : <div className="bubble">{m.content}</div>}
        </div>
      ))}
    </div>
  );
}

// ── 左ペイン: 壁打ち（空状態のオンボーディング + チャット + コンポーザ）──────
export function ConversationPane(props: {
  messages: Message[];
  phase: Phase;
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onMakeOutline: () => void;
  onGenerate: () => void;
  busy: boolean;
  modelId: string;
  hasDsl: boolean;
  purposes: string[];
  purpose: string;
  onPurposeChange: (p: string) => void;
  examples: string[];
  onExample: (text: string) => void;
  attachments: IngestResult[];
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // 新メッセージでチャット枠を最下部へ（内部スクロール領域のため必須）。
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [props.messages]);
  const empty = props.messages.length === 0;
  const canSend = !props.busy && !!props.modelId && props.input.trim().length > 0;

  return (
    <section className="pane talk-pane" aria-label="壁打ち">
      <div className="pane-head">
        <span className="eyebrow">壁打ち{empty ? " · はじめに" : ""}</span>
        {props.attachments.length > 0 && (
          <span className="head-note">添付 {props.attachments.length} 件</span>
        )}
      </div>

      <div className="chat-scroll">
        {props.hasDsl && (
          <div className="notice">✏️ 既存スライドの修正モード。直したい点を送って「今ある情報で生成」を押すと更新します。</div>
        )}
        {empty ? (
          <div className="hero">
            <h2>何を、誰に<br />伝えますか？</h2>
            <p className="lede">ひと言で目的を教えてください。足りない所は質問しながら一緒に整えます。配置や配色は気にしなくて大丈夫。</p>
            <div className="chips" role="group" aria-label="スライドの目的">
              {props.purposes.filter((p) => !p.startsWith("（")).map((p) => (
                <button key={p} className={`chip${props.purpose === p ? " sel" : ""}`}
                  onClick={() => props.onPurposeChange(p)}>{p}</button>
              ))}
            </div>
            {props.examples.length > 0 && <>
              <p className="ex-label">たとえば こんな依頼から</p>
              <div className="examples">
                {props.examples.map((q) => (
                  <button key={q} className="ex-card" onClick={() => props.onExample(q)}>
                    <span className="q">{q}</span><span className="arq" aria-hidden="true">↵</span>
                  </button>
                ))}
              </div>
            </>}
          </div>
        ) : (
          <ChatView messages={props.messages} />
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {props.attachments.length > 0 && (
          <div className="attach-chips">
            {props.attachments.map((a) => (
              <span className="attach-chip" key={a.name}>
                {a.name}
                <button className="link-btn" title="削除" onClick={() => props.onRemoveAttachment(a.name)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="input-wrap">
          <textarea
            placeholder="作りたいスライドについて、ひと言で…（例：来月の経営会議で新監視基盤の導入承認を得たい）"
            value={props.input}
            onChange={(e) => props.onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) props.onSend(); }}
          />
          <div className="composer-row">
            <input ref={fileRef} type="file" multiple hidden
              accept=".xlsx,.xls,.csv,.tsv,.pptx,.png,.jpg,.jpeg,.txt,.md"
              onChange={(e) => props.onFiles(e.target.files)} />
            <button className="ghost-icon" title="ファイルを添付" aria-label="ファイルを添付"
              onClick={() => fileRef.current?.click()}>📎</button>
            <span className="grow" />
            {props.phase === "hearing" && props.messages.length > 0 && (
              <button className="btn ghost" onClick={props.onMakeOutline} disabled={props.busy || !props.modelId}>流れを作る →</button>
            )}
            <button className="btn ghost" onClick={props.onGenerate} disabled={props.busy || !props.modelId}>今ある情報で生成 →</button>
            {props.busy ? (
              <button className="btn" onClick={props.onStop}>停止</button>
            ) : (
              <button className="btn" onClick={props.onSend} disabled={!canSend}>
                送信 <span className="kbd">⌘↵</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const STAGE_LABEL: Record<RenderStage, string> = {
  idle: "", ready: "",
  "loading-pyodide": "Pyodide を読み込み中…（初回のみ数秒）",
  "loading-micropip": "パッケージ管理を初期化中…",
  "installing-slidegen": "slidegen と依存(python-pptx 等)を導入中…",
  "warming-up": "ウォームアップ中…",
  error: "エラーが発生しました",
};

// DSL の {強調} をハイライター span に変換（プレビューでも「1スライド1強調」の署名を表現）。
function emph(text: string) {
  return text.split(/(\{[^}]+\})/).map((part, i) =>
    part.startsWith("{") && part.endsWith("}")
      ? <span key={i} className="hl">{part.slice(1, -1)}</span>
      : <span key={i}>{part}</span>);
}

function PreviewCards({ slides }: { slides: SlidePreview[] }) {
  return (
    <div className="cards">
      {slides.map((s, i) => (
        <div key={i} className="slide-card">
          <div className="sc-inner">
            <div className="sc-top"><span className="sc-no">{i + 1}</span><span className="sc-type">{s.type}</span></div>
            {s.kicker && <div className="sc-kicker">{s.kicker}</div>}
            <div className="sc-headline">{s.headline ? emph(s.headline) : <em>（headline なし）</em>}</div>
            {s.columns.length > 0 && <div className="sc-cols">列: {s.columns.join(" / ")}</div>}
            {s.blocks.length > 0 && (
              <div className="sc-els">
                {s.blocks.slice(0, 4).map((b, j) => (
                  <div key={j} className={`sc-el${b.highlight ? " hl-el" : ""}`}>
                    {b.title && <div className={`el-title${b.highlight ? " star" : ""}`}>{emph(b.title)}{b.highlight ? " ★" : ""}</div>}
                    <div className="el-body">
                      {emph((b.lines.length ? b.lines : b.rows.map((r) => r.join(" / "))).slice(0, 3).join(" ・ "))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 右ペイン: デッキ（構成プレビュー / DSL / レビュー）+ 生成・DL ─────────
export type DeckTab = "preview" | "dsl" | "review";
export function DeckPane(props: {
  tab: DeckTab;
  onTab: (t: DeckTab) => void;
  dsl: string;
  onDslChange: (v: string) => void;
  dslValid: boolean;
  preview: SlidePreview[] | null;
  previewing: boolean;
  onPreview: () => void;
  onRender: () => void;
  rendering: boolean;
  renderStage: RenderStage;
  hasTemplate: boolean;
  onReview: () => void;
  reviewText: string;
  onApplyReview: () => void;
  canApplyReview: boolean;
  busy: boolean;
  genRunning: boolean;
  generatingModel: string;
  genNotice: string | null;
  genFailedRaw: string | null;
  error: string | null;
  onRegenerate: () => void;
  deckCount: number;
}) {
  const hasDeck = props.dsl.trim().length > 0;

  // 生成中: 進捗のみ（劣化モデルの生出力は出さない）。
  if (props.genRunning) {
    return (
      <section className="pane deck-pane" aria-label="デッキ">
        <div className="pane-head"><span className="eyebrow">デッキ</span></div>
        <div className="gen-progress" role="status" aria-live="polite">
          <div className="spinner" />
          <p className="title">✍️ AI がスライドを生成しています…</p>
          <p className="sub">モデル: {props.generatingModel}</p>
        </div>
      </section>
    );
  }

  // 生成失敗（無効DSL）: 反映せず、親切なエラー + 再生成導線。
  if (props.genFailedRaw != null) {
    return (
      <section className="pane deck-pane" aria-label="デッキ">
        <div className="pane-head"><span className="eyebrow">デッキ</span></div>
        <div className="deck-scroll">
          <div className="error">
            ⚠ {props.error || "AIが有効なDSLを生成できませんでした。"}
            <div className="error-actions">
              <button className="btn" onClick={props.onRegenerate} disabled={props.busy}>もう一度生成</button>
              <details><summary>生成結果を表示（デバッグ）</summary><pre>{props.genFailedRaw}</pre></details>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 空デッキ: ゴーストスライド + 案内。
  if (!hasDeck) {
    return (
      <section className="pane deck-pane" aria-label="デッキ">
        <div className="pane-head"><span className="eyebrow">デッキ</span><span className="head-note">0 枚</span></div>
        <div className="deck-empty">
          <div className="ghost-slide">ここにスライドが生まれます</div>
          <p>左で会話して「今ある情報で生成」を押すと、ここに構成（型・見出し・要素）が組み上がります。いつでも編集・PowerPoint 出力できます。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pane deck-pane" aria-label="デッキ">
      <div className="pane-head">
        <div className="deck-tabs" role="tablist">
          <button role="tab" aria-selected={props.tab === "preview"} className={props.tab === "preview" ? "on" : ""}
            onClick={() => props.onTab("preview")}>構成プレビュー</button>
          <button role="tab" aria-selected={props.tab === "dsl"} className={props.tab === "dsl" ? "on" : ""}
            onClick={() => props.onTab("dsl")}>DSL</button>
          <button role="tab" aria-selected={props.tab === "review"} className={props.tab === "review" ? "on" : ""}
            onClick={() => props.onTab("review")}>AIレビュー</button>
        </div>
        <span className="head-note">{props.deckCount} 枚</span>
      </div>

      <div className="deck-scroll">
        {props.genNotice && <div className="notice">ℹ️ {props.genNotice}</div>}

        {props.tab === "preview" && (
          props.previewing
            ? <div className="gen-progress"><div className="spinner" /><p className="sub">構成を読み込み中…</p></div>
            : props.preview
              ? <PreviewCards slides={props.preview} />
              : <div className="deck-empty">
                  <p>構成（型・主張・要素）をカードで確認できます。</p>
                  <button className="btn ghost" onClick={props.onPreview} disabled={!props.dslValid}>構成プレビューを表示</button>
                </div>
        )}

        {props.tab === "dsl" && (
          <textarea className="dsl-editor" value={props.dsl} spellCheck={false}
            placeholder="ここに生成された DSL が表示されます。直接編集もできます。"
            onChange={(e) => props.onDslChange(e.target.value)} />
        )}

        {props.tab === "review" && (
          props.busy
            ? <div className="gen-progress"><div className="spinner" /><p className="sub">AI がレビュー中…</p></div>
            : props.reviewText
              ? <div className="review">
                  <div className="review-body">{props.reviewText}</div>
                  {props.canApplyReview && <button className="btn" onClick={props.onApplyReview}>改善後DSLを反映</button>}
                </div>
              : <div className="deck-empty">
                  <p>3観点（内容・体裁・流れ）で講評し、改善後の DSL を返します。</p>
                  <button className="btn ghost" onClick={props.onReview} disabled={!props.dslValid}>AIレビューを実行</button>
                </div>
        )}
      </div>

      <div className="deck-actions">
        <button className="btn lg block" onClick={props.onRender} disabled={props.rendering || props.busy || !props.dslValid}>
          {props.rendering
            ? (STAGE_LABEL[props.renderStage] || "生成中…")
            : <><span className="play" aria-hidden="true">▶</span> PowerPoint を生成・DL{props.hasTemplate ? "（テンプレ適用）" : ""}</>}
        </button>
      </div>
    </section>
  );
}

export function RenderOverlay({ stage, rendering }: { stage: RenderStage; rendering: boolean }) {
  const loading = rendering && stage !== "ready" && stage !== "idle";
  if (!loading) return null;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="spinner" />
        <p>{STAGE_LABEL[stage] || "pptx を生成中…"}</p>
      </div>
    </div>
  );
}
