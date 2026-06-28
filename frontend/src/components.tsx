// components.tsx — 表示用コンポーネント群（ロジックは App.tsx）。
import type { Phase } from "./prompts";
import type { Message } from "./phases";
import type { IngestResult } from "./ingest";
import type { ModelInfo } from "./api";
import type { RenderStage, TemplateFile, SlidePreview } from "./render/renderClient";
import { renderMarkdown } from "./md";

// フェーズの「スライドレール」: デッキのコマ送りで現在地を常時示す署名要素。
// 各段は 16:9 のスライドチップ＋細いレールで連結。番号は実際の工程順を表す。
const PHASE_STEPS: { label: string }[] = [
  { label: "壁打ち" },
  { label: "流れ" },
  { label: "DSL生成" },
  { label: "PowerPoint" },
];
// 現フェーズ → レール上のアクティブ index（review/revise は dsl=2 に集約）。
function phaseIndex(phase: Phase): number {
  switch (phase) {
    case "hearing": return 0;
    case "outline": return 1;
    case "dsl":
    case "review":
    case "revise": return 2;
  }
}

export function PhaseBar({ phase }: { phase: Phase }) {
  const active = phaseIndex(phase);
  return (
    <ol className="phase-rail" aria-label="作成の進行">
      {PHASE_STEPS.map((s, i) => {
        const state = i < active ? "done" : i === active ? "current" : "future";
        return (
          <li key={s.label} className={`phase-step ${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="phase-slide">{i + 1}</span>
            <span className="phase-label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ChatView({ messages }: { messages: Message[] }) {
  return (
    <div className="chat">
      {messages.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          {m.role === "assistant"
            ? <div className="bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            : <div className="bubble">{m.content}</div>}
        </div>
      ))}
    </div>
  );
}

// Pyodide ロード〜生成の進捗オーバーレイ。
const STAGE_LABEL: Record<RenderStage, string> = {
  idle: "", ready: "",
  "loading-pyodide": "Pyodide を読み込み中…（初回のみ数秒）",
  "loading-micropip": "パッケージ管理を初期化中…",
  "installing-slidegen": "slidegen と依存(python-pptx 等)を導入中…",
  "warming-up": "ウォームアップ中…",
  error: "エラーが発生しました",
};
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

export function Sidebar(props: {
  models: ModelInfo[];
  modelId: string;
  onModelChange: (id: string) => void;
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
}) {
  return (
    <aside className="sidebar">
      <h2>⚙️ 設定</h2>
      <label>AIモデル</label>
      <select value={props.modelId} onChange={(e) => props.onModelChange(e.target.value)}>
        {props.models.length === 0 && <option value="">(利用可能モデルなし)</option>}
        {props.models.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <small>本番モデルは gateway に API キー(secret)を設定すると表示されます。</small>

      <label>スライドの主な目的</label>
      <select value={props.purpose} onChange={(e) => props.onPurposeChange(e.target.value)}>
        {props.purposes.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <hr />
      <h3>📎 添付ファイル</h3>
      <input
        type="file" multiple
        accept=".xlsx,.xls,.csv,.tsv,.pptx,.png,.jpg,.jpeg,.txt,.md"
        onChange={(e) => props.onFiles(e.target.files)}
      />
      <ul className="attach-list">
        {props.attachments.map((a) => (
          <li key={a.name}>
            <span>✓ {a.name} … {a.kind}</span>
            <button className="link-btn" title="削除" onClick={() => props.onRemoveAttachment(a.name)}>×</button>
          </li>
        ))}
      </ul>

      <hr />
      <h3>🎨 会社テンプレート（任意）</h3>
      <small>.potx / .pptx を土台にして生成します。</small>
      <input type="file" accept=".potx,.pptx" onChange={(e) => props.onTemplate(e.target.files)} />
      {props.template && (
        <p className="tpl-row">
          <span>✓ {props.template.name}</span>
          <button className="link-btn" title="解除" onClick={props.onClearTemplate}>×</button>
        </p>
      )}

      <hr />
      <button className="ghost" onClick={props.onReset}>🔄 会話をリセット</button>
    </aside>
  );
}

// 構成プレビュー（DSL をパースしたスライド構成のカード一覧）。
// 注: pptx の画素レンダリングではなく「構成（型・主張・要素）」のプレビュー。
export function PreviewCards({ slides }: { slides: SlidePreview[] }) {
  return (
    <div className="preview-grid">
      {slides.map((s, i) => (
        <div key={i} className="preview-card">
          <div className="pc-head">
            <span className="pc-no">{i + 1}</span>
            <span className="pc-type">{s.type}</span>
          </div>
          {s.kicker && <div className="pc-kicker">{s.kicker}</div>}
          <div className="pc-headline">{s.headline || <em>（headline なし）</em>}</div>
          {s.columns.length > 0 && <div className="pc-cols">列: {s.columns.join(" / ")}</div>}
          <ul className="pc-blocks">
            {s.blocks.slice(0, 6).map((b, j) => (
              <li key={j}>
                {b.title && <strong>{b.title}{b.highlight ? " ★" : ""}: </strong>}
                {(b.lines.length ? b.lines : b.rows.map((r) => r.join(" / "))).slice(0, 4).join(" ・ ")}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DslPanel(props: {
  dsl: string;
  onChange: (v: string) => void;
  onRender: () => void;
  onReview: () => void;
  onBackToChat: () => void;
  reviewText: string;
  onApplyReview: () => void;
  canApplyReview: boolean;
  renderStage: RenderStage;
  rendering: boolean;
  generating: boolean;      // 何らかの AI 処理中（ボタン無効化用）
  dslGenerating: boolean;   // DSL 生成中（進捗カードに切替）
  generatingModel: string;  // 進捗カードに出すモデル名
  onPreview: () => void;
  previewing: boolean;
  preview: SlidePreview[] | null;
  hasTemplate: boolean;
}) {
  // DSL 生成中は「進捗のみ」を表示し、途中の生出力（劣化モデルの `}` 連発等）は見せない。
  if (props.dslGenerating) {
    return (
      <div className="dslpanel">
        <div className="gen-progress" role="status" aria-live="polite">
          <div className="spinner" />
          <p className="gen-progress-title">✍️ AIがスライドを生成しています…</p>
          <p className="gen-progress-sub">モデル: {props.generatingModel}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="dslpanel">
      <div className="dsl-toolbar">
        <button onClick={props.onRender} disabled={props.rendering || props.generating}>
          {props.rendering ? "生成中…" : `▶ PowerPointを生成${props.hasTemplate ? "（テンプレ適用）" : ""}・DL`}
        </button>
        <button className="ghost" onClick={props.onPreview} disabled={props.previewing || props.generating}>
          {props.previewing ? "プレビュー中…" : "👁 構成プレビュー"}
        </button>
        <button className="ghost" onClick={props.onReview} disabled={props.generating}>🔍 AIレビュー</button>
        <button className="ghost" onClick={props.onBackToChat}>← チャットで修正</button>
        {props.generating && <span className="stage">✍️ AIレビュー中…</span>}
      </div>
      {props.preview && <PreviewCards slides={props.preview} />}
      <textarea
        className="dsl-editor"
        value={props.dsl}
        spellCheck={false}
        placeholder="ここに生成された DSL が表示されます。直接編集もできます。"
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.reviewText && (
        <div className="review">
          <h3>AIレビュー</h3>
          <pre>{props.reviewText}</pre>
          {props.canApplyReview && (
            <button onClick={props.onApplyReview}>改善後DSLを反映</button>
          )}
        </div>
      )}
    </div>
  );
}
