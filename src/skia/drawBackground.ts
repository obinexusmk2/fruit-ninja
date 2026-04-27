import type {SkCanvas, SkImage} from '@shopify/react-native-skia';
import {Skia} from '@shopify/react-native-skia';

export function drawBackground(
  canvas: SkCanvas,
  image: SkImage | null,
  screenW: number,
  screenH: number,
): void {
  const paint = Skia.Paint();
  if (image) {
    const scaleX = screenW / image.width();
    const scaleY = screenH / image.height();
    canvas.save();
    canvas.scale(scaleX, scaleY);
    canvas.drawImage(image, 0, 0, paint);
    canvas.restore();
  } else {
    paint.setColor(Skia.Color('#1a0a00'));
    canvas.drawRect({x: 0, y: 0, width: screenW, height: screenH}, paint);
  }
}
