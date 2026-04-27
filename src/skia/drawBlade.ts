import type {SkCanvas} from '@shopify/react-native-skia';
import {Skia, PaintStyle, StrokeCap, StrokeJoin} from '@shopify/react-native-skia';
import type {BladeTrail} from '../game/types';

export function drawBlade(canvas: SkCanvas, trail: BladeTrail): void {
  const pts = trail.points;
  if (pts.length < 2 || !trail.active) return;

  // Build a tapered filled path: wide at head (newest), narrow at tail (oldest)
  const path = Skia.Path.Make();
  const n = pts.length;
  const maxW = 14;
  const minW = 0.5;

  // Top edge: oldest → newest
  const topX: number[] = [];
  const topY: number[] = [];
  const botX: number[] = [];
  const botY: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 2);
    const halfW = (minW + (maxW - minW) * t) / 2;
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
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

  if (topX.length === 0) return;

  path.moveTo(topX[0]!, topY[0]!);
  for (let i = 1; i < topX.length; i++) {
    path.lineTo(topX[i]!, topY[i]!);
  }
  for (let i = botX.length - 1; i >= 0; i--) {
    path.lineTo(botX[i]!, botY[i]!);
  }
  path.close();

  const fillPaint = Skia.Paint();
  fillPaint.setStyle(PaintStyle.Fill);
  fillPaint.setColor(Skia.Color(trail.color));
  fillPaint.setAlphaf(0.82);
  canvas.drawPath(path, fillPaint);

  // White glow center line
  const spine = Skia.Path.Make();
  spine.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < n; i++) {
    spine.lineTo(pts[i]!.x, pts[i]!.y);
  }
  const glowPaint = Skia.Paint();
  glowPaint.setStyle(PaintStyle.Stroke);
  glowPaint.setStrokeWidth(2.5);
  glowPaint.setStrokeCap(StrokeCap.Round);
  glowPaint.setStrokeJoin(StrokeJoin.Round);
  glowPaint.setColor(Skia.Color('#FFFFFF'));
  glowPaint.setAlphaf(0.45);
  canvas.drawPath(spine, glowPaint);
}
