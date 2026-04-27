import type {SkCanvas, SkImage} from '@shopify/react-native-skia';
import {Skia} from '@shopify/react-native-skia';
import type {FruitEntity} from '../game/types';

const SPRITE_SIZE = 84;

function drawSprite(
  canvas: SkCanvas,
  image: SkImage | null,
  x: number,
  y: number,
  rotation: number,
): void {
  if (!image) return;
  const half = SPRITE_SIZE / 2;
  const paint = Skia.Paint();
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate((rotation * 180) / Math.PI, 0, 0);
  canvas.drawImageRect(
    image,
    {x: 0, y: 0, width: image.width(), height: image.height()},
    {x: -half, y: -half, width: SPRITE_SIZE, height: SPRITE_SIZE},
    paint,
  );
  canvas.restore();
}

export function drawFruit(
  canvas: SkCanvas,
  entity: FruitEntity,
  images: Record<string, SkImage | null>,
): void {
  const {kind, state} = entity;

  if (state === 'whole') {
    drawSprite(canvas, images[kind] ?? null, entity.x, entity.y, entity.rotation);
    return;
  }

  if (state === 'sliced' && kind !== 'bomb') {
    drawSprite(canvas, images[`${kind}_half_1`] ?? null, entity.half1x, entity.half1y, entity.half1rot);
    drawSprite(canvas, images[`${kind}_half_2`] ?? null, entity.half2x, entity.half2y, entity.half2rot);
    return;
  }

  if (state === 'exploding') {
    drawSprite(canvas, images.explosion ?? null, entity.x, entity.y, entity.rotation);
  }
}

export function drawSplash(
  canvas: SkCanvas,
  entity: FruitEntity,
  splashImage: SkImage | null,
): void {
  if (entity.splashTimer <= 0 || !splashImage) return;
  const alpha = entity.splashTimer / 22;
  const size = SPRITE_SIZE * 1.4;
  const paint = Skia.Paint();
  paint.setAlphaf(alpha);
  canvas.save();
  canvas.translate(entity.splashX, entity.splashY);
  canvas.drawImageRect(
    splashImage,
    {x: 0, y: 0, width: splashImage.width(), height: splashImage.height()},
    {x: -size / 2, y: -size / 2, width: size, height: size},
    paint,
  );
  canvas.restore();
}
