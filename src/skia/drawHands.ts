import type {SkCanvas} from '@shopify/react-native-skia';
import {Skia, PaintStyle, StrokeCap} from '@shopify/react-native-skia';
import type {HandOverlay} from '../input/handAdapter';
import {BLADE_COLORS} from '../input/types';

// MediaPipe hand skeleton: pairs of landmark indices.
const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

/**
 * Draws the tracked hands over the camera preview. Confirmed hands use their
 * blade colour (cyan / orange); hands still being confirmed are dim, which is
 * what tells the player "I see you, hold still".
 */
export function drawHands(canvas: SkCanvas, overlay: HandOverlay | null): void {
  if (!overlay) {
    return;
  }
  for (const hand of overlay.hands) {
    const color =
      hand.confirmed && hand.slot !== null
        ? BLADE_COLORS[hand.slot] ?? '#00FFFF'
        : '#8899AA';
    const line = Skia.Paint();
    line.setStyle(PaintStyle.Stroke);
    line.setStrokeWidth(3);
    line.setStrokeCap(StrokeCap.Round);
    line.setColor(Skia.Color(color));
    line.setAlphaf(hand.confirmed ? 0.85 : 0.5);

    const b = Skia.PathBuilder.Make();
    for (const [a, c] of CONNECTIONS) {
      const p = hand.points[a];
      const q = hand.points[c];
      if (p && q) {
        b.moveTo(p.x, p.y);
        b.lineTo(q.x, q.y);
      }
    }
    canvas.drawPath(b.detach(), line);

    const dot = Skia.Paint();
    dot.setColor(Skia.Color(color));
    dot.setAlphaf(hand.confirmed ? 1 : 0.6);
    for (let i = 0; i < hand.points.length; i++) {
      const p = hand.points[i]!;
      // Fingertips used for the blade are drawn larger.
      canvas.drawCircle(p.x, p.y, i === 8 || i === 12 ? 6 : 3, dot);
    }
  }
}
