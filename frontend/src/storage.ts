// storage.ts — UI設定の永続化（localStorage）。
// モデル選択・目的を保存し、次回起動時に復元する。
// 添付やテンプレートのバイナリは保存しない（容量/プライバシーのためセッション限り）。
const KEY = "slidegen.settings.v1";

export interface Settings {
  modelId?: string;
  purpose?: string;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Settings) : {};
  } catch {
    return {};
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage 不可（プライベートモード等）は黙って無視 */
  }
}
