// @vitest-environment jsdom
// renderClient.ts の worker 呼び出しラッパー(call<T>)の堅牢性を検証する。
// classic Worker(public/render-worker.js) 自体は起動しないよう、Worker をモックに差し替える。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class MockWorker {
  static instances: MockWorker[] = [];
  // false にすると init 直後の自動 "ready" 応答を止める（init 失敗/キャンセルのタイミングを模擬するため）。
  static autoReady = true;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  terminated = false;
  lastPosted: any = null;
  constructor(public url: string) { MockWorker.instances.push(this); }
  postMessage(msg: any) {
    this.lastPosted = msg;
    if (msg.type === "init" && MockWorker.autoReady) {
      // 実 worker と同じく非同期で ready を返す。
      queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent));
    }
    // render/preview/inspect は各テストが emit()/fail() で応答を制御する（デフォルトは無応答＝ハング模擬）。
  }
  terminate() { this.terminated = true; }
  emit(data: any) { this.onmessage?.({ data } as MessageEvent); }
  crash(message: string) { this.onerror?.({ message } as ErrorEvent); }
}

beforeEach(() => {
  MockWorker.instances.length = 0;
  MockWorker.autoReady = true;
  vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
  vi.resetModules(); // renderClient.ts のモジュール内 worker/readyPromise を各テストでリセット
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("renderClient (worker 呼び出しの堅牢性)", () => {
  it("応答が無いまま120秒経つとタイムアウトで reject する（pending が永久に残らない）", async () => {
    vi.useFakeTimers();
    const { renderDsl } = await import("../src/render/renderClient");
    const p = renderDsl("slide title");
    const assertion = expect(p).rejects.toThrow(/タイムアウト/);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
  });

  it("worker がクラッシュ(onerror)すると進行中の呼び出しは即 reject される", async () => {
    const { renderDsl } = await import("../src/render/renderClient");
    const p = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances[0]?.lastPosted?.type).toBe("render"));
    MockWorker.instances[0].crash("pyodide OOM");
    await expect(p).rejects.toThrow(/pyodide OOM/);
  });

  it("worker クラッシュ後、次の呼び出しは新しい worker を起動し直す（恒久ハングしない）", async () => {
    const { renderDsl } = await import("../src/render/renderClient");
    const p1 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances[0]?.lastPosted?.type).toBe("render"));
    MockWorker.instances[0].crash("boom");
    await expect(p1).rejects.toThrow();
    expect(MockWorker.instances[0].terminated).toBe(true);

    const p2 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances.length).toBe(2)); // 新しい worker が起動された
    await vi.waitFor(() => expect(MockWorker.instances[1]?.lastPosted?.type).toBe("render"));
    MockWorker.instances[1].emit({ type: "rendered", id: MockWorker.instances[1].lastPosted.id, bytes: new Uint8Array([1, 2, 3]) });
    await expect(p2).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it("terminateRenderer() は進行中の呼び出しを reject し worker を終了する", async () => {
    const { renderDsl, terminateRenderer } = await import("../src/render/renderClient");
    const p = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances[0]?.lastPosted?.type).toBe("render"));
    terminateRenderer("ユーザーがキャンセルしました");
    await expect(p).rejects.toThrow(/キャンセル/);
    expect(MockWorker.instances[0].terminated).toBe(true);
  });

  it("init 完了(ready)前に terminateRenderer() すると、初期化待ちの呼び出しも reject される（恒久ハングしない）", async () => {
    MockWorker.autoReady = false; // ready が届く前にキャンセルするタイミングを作る
    const { renderDsl, terminateRenderer } = await import("../src/render/renderClient");
    const p = renderDsl("slide title"); // まだ init 中（ready 未着）
    terminateRenderer("ユーザーがキャンセルしました");
    await expect(p).rejects.toThrow(/キャンセル/);
    expect(MockWorker.instances[0].terminated).toBe(true);
  });

  it("init が 'error' メッセージで失敗しても、次回呼び出しは新しい worker で再試行できる（恒久失敗しない）", async () => {
    MockWorker.autoReady = false; // ready の代わりに error を手動で emit する
    const { renderDsl } = await import("../src/render/renderClient");
    const p1 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances[0]?.lastPosted?.type).toBe("init"));
    MockWorker.instances[0].emit({ type: "error", error: "wheel 404" });
    await expect(p1).rejects.toThrow(/wheel 404/);
    expect(MockWorker.instances[0].terminated).toBe(true);

    MockWorker.autoReady = true; // 2回目は正常に初期化できる
    const p2 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances.length).toBe(2)); // 新しい worker が起動された
    await vi.waitFor(() => expect(MockWorker.instances[1]?.lastPosted?.type).toBe("render"));
    MockWorker.instances[1].emit({ type: "rendered", id: MockWorker.instances[1].lastPosted.id, bytes: new Uint8Array([7]) });
    await expect(p2).resolves.toEqual(new Uint8Array([7]));
  });

  it("タイムアウト後、詰まった worker は破棄され次の呼び出しは新しい worker で処理される", async () => {
    vi.useFakeTimers();
    const { renderDsl } = await import("../src/render/renderClient");
    const p1 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances[0]?.lastPosted?.type).toBe("render"));
    const assertion = expect(p1).rejects.toThrow(/タイムアウト/);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(MockWorker.instances[0].terminated).toBe(true); // 古い worker は破棄される

    vi.useRealTimers();
    const p2 = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances.length).toBe(2));
    await vi.waitFor(() => expect(MockWorker.instances[1]?.lastPosted?.type).toBe("render"));
    MockWorker.instances[1].emit({ type: "rendered", id: MockWorker.instances[1].lastPosted.id, bytes: new Uint8Array([4]) });
    await expect(p2).resolves.toEqual(new Uint8Array([4]));
  });

  it("正常応答なら resolve する", async () => {
    const { renderDsl } = await import("../src/render/renderClient");
    const p = renderDsl("slide title");
    await vi.waitFor(() => expect(MockWorker.instances.length).toBe(1));
    const w = MockWorker.instances[0];
    await vi.waitFor(() => expect(w.lastPosted?.type).toBe("render"));
    w.emit({ type: "rendered", id: w.lastPosted.id, bytes: new Uint8Array([9]) });
    await expect(p).resolves.toEqual(new Uint8Array([9]));
  });
});
