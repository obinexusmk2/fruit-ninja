import type {TouchInput, TouchPhase} from './touchAdapter';

/** The subset of a React Native touch we rely on. */
export interface RawTouch {
  identifier: number;
  locationX: number;
  locationY: number;
}

export interface RawTouchEvent {
  changedTouches: ReadonlyArray<RawTouch>;
}

/**
 * Converts a React Native touch event into a TouchInput.
 *
 *  - Uses `changedTouches` (only the pointers that changed) and each touch's
 *    stable `identifier`, never its index in `touches`.
 *  - Uses `locationX/locationY`, which are relative to the touched view. The
 *    touch surface is a leaf view that exactly overlays the canvas, so these
 *    are canvas-local (unlike `pageX/pageY`, which are root-relative).
 */
export function touchInputFromEvent(
  phase: TouchPhase,
  event: RawTouchEvent,
  t: number,
): TouchInput {
  return {
    phase,
    t,
    changed: event.changedTouches.map(touch => ({
      id: touch.identifier,
      x: touch.locationX,
      y: touch.locationY,
    })),
  };
}
