import type {SkCanvas, SkImage, SkPaint} from '@shopify/react-native-skia';
import {Skia} from '@shopify/react-native-skia';
import type {FruitEntity} from '../game/types';

// One shared paint for opaque sprites: creating a native Paint per sprite per
// frame is needless allocation.
let spritePaint: SkPaint | null = null;
function getSpritePaint(): SkPaint {
  if (!spritePaint) {
    spritePaint = Skia.Paint();
  }
  return spritePaint;
}

function drawSprite(
  canvas: SkCanvas,
  image: SkImage | null,
  x: number,
  y: number,
  rotation: number,
  size: number,
): void {
  if (!image) {
    return;
  }
  const half = size / 2;
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate((rotation * 180) / Math.PI, 0, 0);
  canvas.drawImageRect(
    image,
    {x: 0, y: 0, width: image.width(), height: image.height()},
    {x: -half, y: -half, width: size, height: size},
    getSpritePaint(),
  );
  canvas.restore();
}

export function drawFruit(
  canvas: SkCanvas,
  entity: FruitEntity,
  images: Record<string, SkImage | null>,
  size: number,
  reducedMotion = false,
): void {
  const {kind, state} = entity;
  const rot = (r: number) => (reducedMotion ? 0 : r);

  if (state === 'whole') {
    drawSprite(canvas, images[kind] ?? null, entity.x, entity.y, rot(entity.rotation), size);
    return;
  }

  if (state === 'sliced' && kind !== 'bomb') {
    const half = size * 0.81;
    drawSprite(canvas, images[`${kind}_half_1`] ?? null, entity.half1x, entity.half1y, rot(entity.half1rot), half);
    drawSprite(canvas, images[`${kind}_half_2`] ?? null, entity.half2x, entity.half2y, rot(entity.half2rot), half);
    return;
  }

  if (state === 'exploding') {
    drawSprite(canvas, images.explosion ?? null, entity.x, entity.y, 0, size * 1.6);
  }
}

/** Fading splash at the slice point; `durationMs` is the full splash lifetime. */
export function drawSplash(
  canvas: SkCanvas,
  entity: FruitEntity,
  splashImage: SkImage | null,
  size: number,
  durationMs: number,
): void {
  if (entity.splashTimer <= 0 || !splashImage) {
    return;
  }
  const alpha = Math.min(1, entity.splashTimer / durationMs);
  const s = size * 1.4;
  const paint = getSpritePaint();
  paint.setAlphaf(alpha);
  canvas.save();
  canvas.translate(entity.splashX, entity.splashY);
  canvas.drawImageRect(
    splashImage,
    {x: 0, y: 0, width: splashImage.width(), height: splashImage.height()},
    {x: -s / 2, y: -s / 2, width: s, height: s},
    paint,
  );
  canvas.restore();
  paint.setAlphaf(1);
}
