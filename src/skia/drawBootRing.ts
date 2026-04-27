import type {SkCanvas} from '@shopify/react-native-skia';
import {Skia, PaintStyle, StrokeCap} from '@shopify/react-native-skia';

// Draws the MMUKO ring-boot animation — mirrors the HTML prototype in index_ringboot.html.
// 5 concentric cyan arcs + 12 rotating nodes + pulsing central core.
export function drawBootRing(
  canvas: SkCanvas,
  cx: number,
  cy: number,
  angle: number,
  completedPhases: number,
  screenW: number,
  screenH: number,
): void {
  // Background
  const bgPaint = Skia.Paint();
  bgPaint.setColor(Skia.Color('#000000'));
  canvas.drawRect({x: 0, y: 0, width: screenW, height: screenH}, bgPaint);

  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);

  // 5 concentric rings
  const radii = [120, 155, 190, 225, 260];
  radii.forEach((r, i) => {
    const alpha = 0.9 - i * 0.18;
    const strokeW = 9 - i * 1.4;
    const ringPaint = Skia.Paint();
    ringPaint.setStyle(PaintStyle.Stroke);
    ringPaint.setStrokeWidth(strokeW);
    ringPaint.setColor(
      Skia.Color(`rgba(0, 230, 255, ${alpha.toFixed(2)})`),
    );
    ringPaint.setStrokeCap(StrokeCap.Round);
    canvas.drawCircle(0, 0, r, ringPaint);
  });

  // 12 rotating nodes at radius 185
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + angle * 3;
    const nx = Math.cos(a) * 185;
    const ny = Math.sin(a) * 185;
    const isActive = i % 3 === completedPhases % 3;
    const nodePaint = Skia.Paint();
    nodePaint.setColor(Skia.Color(isActive ? '#00FF00' : '#00FFFF'));
    canvas.drawCircle(nx, ny, 9, nodePaint);
  }

  canvas.restore();

  // Central core — pulsing circle
  const corePaint = Skia.Paint();
  corePaint.setColor(Skia.Color('rgba(0, 255, 255, 0.2)'));
  canvas.drawCircle(cx, cy, 48, corePaint);

  const coreStroke = Skia.Paint();
  coreStroke.setStyle(PaintStyle.Stroke);
  coreStroke.setStrokeWidth(8);
  coreStroke.setColor(Skia.Color('#00FFFF'));
  canvas.drawCircle(cx, cy, 48, coreStroke);
}
