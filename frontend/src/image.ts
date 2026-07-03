// image.ts — 添付画像を LLM 送信用に縮小・JPEG 化する（マルチモーダル用）。
// gateway の入力上限（MAX_INPUT_BYTES）と /api/chat の画像検証（base64 30万字/枚・4枚）に
// クライアント側で確実に収めるのが役目。ビットマップ操作以外の数値判断は純関数（vitest 対象）。

// 送信予算。gateway 側の MAX_IMAGE_B64_CHARS(300_000) より小さく保つ。
export const IMAGE_MAX_DIM = 1280; // 長辺 px
export const IMAGE_MAX_B64_CHARS = 200_000; // base64 約150KB 相当/枚
export const IMAGE_JPEG_QUALITIES = [0.85, 0.7, 0.5] as const;
export const MAX_IMAGES_PER_REQUEST = 4;

// 長辺 maxDim に収まる整数サイズを返す（拡大はしない）。
export function scaleToFit(width: number, height: number, maxDim = IMAGE_MAX_DIM): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// base64 長が予算内か（gateway に 400 を出させない最終ゲート）。
export function fitsImageBudget(b64Length: number): boolean {
  return b64Length > 0 && b64Length <= IMAGE_MAX_B64_CHARS;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result); // data:image/jpeg;base64,....
      resolve(url.slice(url.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });
}

// 画像バイト列を縮小して {data(base64), mimeType} を返す。予算に収まらなければ throw
// （呼び出し側=ingest はメタ情報のみの従来動作へフォールバックする）。
export async function downscaleImage(buf: ArrayBuffer): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(new Blob([buf]));
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    // JPEG は透過を黒にするため白背景を敷く（スクショ/図の可読性優先）。
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of IMAGE_JPEG_QUALITIES) {
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      const data = await blobToBase64(blob);
      if (fitsImageBudget(data.length)) return { data, mimeType: "image/jpeg" };
    }
    throw new Error("image too large after downscale");
  } finally {
    bitmap.close();
  }
}
