import type {Point} from './types';

export type Rotation = 0 | 90 | 180 | 270;

/**
 * The frame the landmarks are normalised to.
 *
 * The native module already applies the camera rotation inside MediaPipe, so
 * live landmarks are in the UPRIGHT frame and `rotationDegrees` is 0. The
 * rotation step exists so raw sensor-space input can be converted with the same
 * code (and is tested). It must never be applied to data that is already upright.
 */
export interface FrameGeometry {
  /** Pixel size of the frame the landmarks are normalised to. */
  width: number;
  height: number;
  /** Clockwise rotation still needed to make the frame upright (0 for live data). */
  rotationDegrees?: Rotation;
  /** Mirror horizontally once: true for the front camera, whose preview is mirrored. */
  mirror: boolean;
}

export interface ViewGeometry {
  /** Size of the preview / gameplay view the frame is displayed in. */
  width: number;
  height: number;
  /** 'cover' centre-crops (preview FILL_CENTER); 'contain' letterboxes (FIT_CENTER). */
  fit: 'cover' | 'contain';
  /** Where the view's origin sits inside the canvas the game draws in (insets, split windows). */
  offsetX?: number;
  offsetY?: number;
}

/** Rotates a normalised point clockwise by 0/90/180/270 degrees about the frame centre. */
export function rotateNormalized(p: Point, degrees: Rotation): Point {
  switch (degrees) {
    case 90:
      return {x: 1 - p.y, y: p.x};
    case 180:
      return {x: 1 - p.x, y: 1 - p.y};
    case 270:
      return {x: p.y, y: 1 - p.x};
    default:
      return {x: p.x, y: p.y};
  }
}

/** Pixel size of the frame after its rotation. */
export function uprightSize(frame: FrameGeometry): {width: number; height: number} {
  const r = frame.rotationDegrees ?? 0;
  return r === 90 || r === 270
    ? {width: frame.height, height: frame.width}
    : {width: frame.width, height: frame.height};
}

/**
 * Maps a normalised landmark in the detector frame to canvas-local game
 * coordinates. Each step is applied exactly once and in this order:
 *
 *   1. rotation to upright (only for sensor-space input),
 *   2. the front-camera mirror,
 *   3. scaling into the view: cover = max(vw/iw, vh/ih), contain = min(...),
 *      centred, so the crop/letterbox offsets are (view - image*scale) / 2,
 *   4. the view's offset inside the canvas.
 *
 * A bare `(1 - x) * screenWidth` ignores steps 1, 3 and 4 and is wrong as soon
 * as the preview is cropped or the view is not the whole screen.
 */
export function landmarkToCanvas(
  lm: Point,
  frame: FrameGeometry,
  view: ViewGeometry,
): Point {
  const upright = rotateNormalized(lm, frame.rotationDegrees ?? 0);
  const x = frame.mirror ? 1 - upright.x : upright.x;
  const y = upright.y;

  const {width: iw, height: ih} = uprightSize(frame);
  const scale =
    view.fit === 'cover'
      ? Math.max(view.width / iw, view.height / ih)
      : Math.min(view.width / iw, view.height / ih);
  const shownW = iw * scale;
  const shownH = ih * scale;
  const cropX = (view.width - shownW) / 2; // negative when cover crops horizontally
  const cropY = (view.height - shownH) / 2;

  return {
    x: (view.offsetX ?? 0) + cropX + x * shownW,
    y: (view.offsetY ?? 0) + cropY + y * shownH,
  };
}

/** Landmark indices used by the game (MediaPipe hand model). */
export const INDEX_FINGER_TIP = 8;
export const MIDDLE_FINGER_TIP = 12;
export const LANDMARKS_PER_HAND = 21;
export const VALUES_PER_HAND = LANDMARKS_PER_HAND * 2;

/**
 * Blade anchor for one hand: the midpoint of the index and middle fingertips,
 * matching the browser version. `landmarks` is the flat x,y array from native;
 * returns null if that hand's block is missing or non-finite.
 */
export function bladeAnchor(
  landmarks: ArrayLike<number>,
  handIndex: number,
): Point | null {
  const base = handIndex * VALUES_PER_HAND;
  if (base < 0 || base + VALUES_PER_HAND > landmarks.length) {
    return null;
  }
  const x = (landmarks[base + INDEX_FINGER_TIP * 2]! + landmarks[base + MIDDLE_FINGER_TIP * 2]!) / 2;
  const y =
    (landmarks[base + INDEX_FINGER_TIP * 2 + 1]! + landmarks[base + MIDDLE_FINGER_TIP * 2 + 1]!) / 2;
  return Number.isFinite(x) && Number.isFinite(y) ? {x, y} : null;
}
