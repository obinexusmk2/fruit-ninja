import type {SkCanvas} from '@shopify/react-native-skia';
import {Skia, PaintStyle, StrokeCap, StrokeJoin} from '@shopify/react-native-skia';
import type {BladeTrail} from '../game/types';

/**
 * Draws a blade trail: a tapered filled ribbon (wide at the newest sample,
 * narrow at the oldest) plus a thin white centre line.
 * @param scale width multiplier so the blade stays proportional on any screen.
 */
export function drawBlade(canvas: SkCanvas, trail: BladeTrail, scale = 1): void {
  const pts = trail.points;
  if (pts.length < 2 || !trail.active) {
    return;
  }

  // PathBuilder replaces the deprecated mutable SkPath.moveTo/lineTo/close
  // (Skia 2.6+ logs a deprecation warning for each call).
  const ribbon = Skia.PathBuilder.Make();
  const n = pts.length;
  const maxW = 14 * scale;
  const minW = 0.5 * scale;

  const topX: number[] = [];
  const topY: number[] = [];
  const botX: number[] = [];
  const botY: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const t = n > 2 ? i / (n - 2) : 1;
    const halfW = (minW + (maxW - minW) * t) / 2;
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;
    topX.push(a.x + nx);
    topY.push(a.y + ny);
    botX.push(a.x - nx);
    botY.push(a.y - ny);
  }

  if (topX.length === 0) {
    return;
  }

  ribbon.moveTo(topX[0]!, topY[0]!);
  for (let i = 1; i < topX.length; i++) {
    ribbon.lineTo(topX[i]!, topY[i]!);
  }
  for (let i = botX.length - 1; i >= 0; i--) {
    ribbon.lineTo(botX[i]!, botY[i]!);
  }
  ribbon.close();

  const fillPaint = Skia.Paint();
  fillPaint.setStyle(PaintStyle.Fill);
  fillPaint.setColor(Skia.Color(trail.color));
  fillPaint.setAlphaf(0.82);
  canvas.drawPath(ribbon.detach(), fillPaint);

  const spineBuilder = Skia.PathBuilder.Make();
  spineBuilder.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < n; i++) {
    spineBuilder.lineTo(pts[i]!.x, pts[i]!.y);
  }
  const spine = spineBuilder.detach();
  const glowPaint = Skia.Paint();
  glowPaint.setStyle(PaintStyle.Stroke);
  glowPaint.setStrokeWidth(2.5 * scale);
  glowPaint.setStrokeCap(StrokeCap.Round);
  glowPaint.setStrokeJoin(StrokeJoin.Round);
  glowPaint.setColor(Skia.Color('#FFFFFF'));
  glowPaint.setAlphaf(0.45);
  canvas.drawPath(spine, glowPaint);
}
