// components.tsx — 表示用コンポーネント群（ロジックは App.tsx）。
import type { Phase } from "./prompts";
import type { Message } from "./phases";
import type { IngestResult } from "./ingest";
import type { ModelInfo } from "./api";
import type { RenderStage } from "./render/renderClient";

const PHASE_LABELS: Record<Phase, string> = {
  hearing: "① 壁打ち",
  outline: "② 流れの作成",
  dsl: "③ DSL生成・編集",
  review: "③ レビュー",
  revise: "③ 修正",
};
const PHASE_ORDER: Phase[] = ["hearing", "outline", "dsl"];

export function PhaseBar({ phase }: { phase: Phase }) {
  const active = phase === "review" || phase === "revise" ? "dsl" : phase;
  return (
    <div className="phasebar">
      {PHASE_ORDER.map((p) => (
        <span key={p} className={p === active ? "phase active" : "phase"}>
          {PHASE_LABELS[p]}
        </span>
      ))}
      <span className={phase === "dsl" ? "phase done-step" : "phase"}>④ PowerPoint生成</span>
    </div>
  );
}

export function ChatView({ messages }: { messages: Message[] }) {
  return (
    <div className="chat">
      {messages.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          <div className="bubble">{m.content}</div>
        </div>
      ))}
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
        {props.attachments.map((a) => <li key={a.name}>✓ {a.name} … {a.kind}</li>)}
      </ul>

      <hr />
      <button className="ghost" onClick={props.onReset}>🔄 会話をリセット</button>
    </aside>
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
  error: string | null;
}) {
  return (
    <div className="dslpanel">
      <div className="dsl-toolbar">
        <button onClick={props.onRender} disabled={props.rendering}>
          {props.rendering ? "生成中…" : "▶ PowerPointを生成・ダウンロード"}
        </button>
        <button className="ghost" onClick={props.onReview}>🔍 AIレビュー</button>
        <button className="ghost" onClick={props.onBackToChat}>← チャットで修正</button>
        {props.renderStage !== "idle" && props.renderStage !== "ready" && (
          <span className="stage">Pyodide: {props.renderStage}…</span>
        )}
      </div>
      {props.error && <div className="error">⚠ {props.error}</div>}
      <textarea
        className="dsl-editor"
        value={props.dsl}
        spellCheck={false}
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
