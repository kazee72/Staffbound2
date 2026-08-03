/**
 * Shared GIF-decoding core, used by both the player mage (gifSprite.ts) and
 * enemy sprite assets (enemySpriteAssets.ts) to turn a raw GIF ArrayBuffer
 * into a sequence of fully-composited RGBA frame canvases.
 *
 * GIF frames are frequently small "dirty rect" patches over the previous
 * frame rather than full frames, so this respects each frame's disposal
 * method (see compositeFrames()) to reconstruct the correct full frame.
 */
import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js';

export interface DecodedGif {
  width: number;
  height: number;
  frames: HTMLCanvasElement[];
  /** Per-frame display duration in milliseconds (gifuct-js already converts to ms). */
  delaysMs: number[];
}

/** Parses + fully composites a GIF's frames. Returns null if it's empty/unparsable. */
export function decodeGif(buf: ArrayBuffer): DecodedGif | null {
  const gif = parseGIF(buf);
  const parsedFrames = decompressFrames(gif, true);
  if (parsedFrames.length === 0) return null;

  const width = gif.lsd.width;
  const height = gif.lsd.height;
  const frames = compositeFrames(parsedFrames, width, height);
  const delaysMs = parsedFrames.map((f) => Math.max(20, f.delay || 100));
  return { width, height, frames, delaysMs };
}

/**
 * Composite gifuct-js's raw per-frame patches into full WxH RGBA frames,
 * honoring each frame's disposal method (patches only cover the region of
 * the canvas that changed, not the whole image).
 */
function compositeFrames(frames: ParsedFrame[], w: number, h: number): HTMLCanvasElement[] {
  const patchCanvas = document.createElement('canvas');
  const patchCtx = patchCanvas.getContext('2d')!;
  const composite = document.createElement('canvas');
  composite.width = w;
  composite.height = h;
  const compositeCtx = composite.getContext('2d', { willReadFrequently: true })!;

  const out: HTMLCanvasElement[] = [];
  let prevSnapshot: ImageData | null = null;

  frames.forEach((frame, i) => {
    // Apply the previous frame's disposal before drawing this one.
    if (i > 0) {
      const prev = frames[i - 1];
      if (prev.disposalType === 2) {
        compositeCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      } else if (prev.disposalType === 3 && prevSnapshot) {
        compositeCtx.putImageData(prevSnapshot, 0, 0);
      }
    }

    // Snapshot the canvas as it stands before drawing this frame, in case
    // the NEXT frame's disposal is "restore to previous".
    prevSnapshot = compositeCtx.getImageData(0, 0, w, h);

    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const imageData = patchCtx.createImageData(frame.dims.width, frame.dims.height);
    imageData.data.set(frame.patch);
    patchCtx.putImageData(imageData, 0, 0);
    compositeCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = w;
    frameCanvas.height = h;
    frameCanvas.getContext('2d')!.drawImage(composite, 0, 0);
    out.push(frameCanvas);
  });

  return out;
}

/**
 * Packs a set of same-size frame canvases into a grid-based sprite sheet
 * canvas (not a single strip — a long GIF at any real resolution would
 * otherwise produce a sprite sheet wider than the GPU's max texture size).
 */
export function packFrameGrid(
  frameCanvases: HTMLCanvasElement[],
  w: number,
  h: number,
  maxAtlasDim = 8192,
): { sheet: HTMLCanvasElement; cols: number } {
  const cols = Math.max(1, Math.min(Math.floor(maxAtlasDim / w), Math.ceil(Math.sqrt(frameCanvases.length))));
  const rows = Math.ceil(frameCanvases.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = w * cols;
  sheet.height = h * rows;
  const ctx = sheet.getContext('2d')!;
  frameCanvases.forEach((fc, i) => ctx.drawImage(fc, (i % cols) * w, Math.floor(i / cols) * h));
  return { sheet, cols };
}
