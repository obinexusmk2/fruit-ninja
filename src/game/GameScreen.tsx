import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import {
  Canvas,
  createPicture,
  Picture,
  useImage,
} from '@shopify/react-native-skia';
import type {SkImage, SkPicture} from '@shopify/react-native-skia';
import {FruitPool} from './objectPool';
import {
  burstCount,
  nextSpawnInterval,
  spawnFruit,
} from './fruitSpawner';
import {trailHitsCircle} from './collisionDetection';
import {drawBackground} from '../skia/drawBackground';
import {drawBlade} from '../skia/drawBlade';
import {drawFruit, drawSplash} from '../skia/drawFruit';
import {SPRITES, FRUIT_SPLASH_KEY} from './assets';
import type {BladeTrail, FruitEntity, FruitKind, GameState} from './types';
import {
  GRAVITY,
  HALF_KICK_V,
  HALF_LATERAL_V,
  LIVES_START,
  SPLASH_DURATION,
  TRAIL_MAX_POINTS,
} from './constants';
import {HUD} from '../ui/HUD';

interface GameScreenProps {
  onGameOver: (score: number) => void;
}

function makeTrail(color: string): BladeTrail {
  return {points: [], active: false, color};
}

function sliceEntity(entity: FruitEntity, sliceAngle: number): void {
  entity.state = 'sliced';
  entity.half1x = entity.x;
  entity.half1y = entity.y;
  entity.half1vx = entity.vx - Math.cos(sliceAngle) * HALF_LATERAL_V;
  entity.half1vy = entity.vy + HALF_KICK_V;
  entity.half1rot = entity.rotation;
  entity.half2x = entity.x;
  entity.half2y = entity.y;
  entity.half2vx = entity.vx + Math.cos(sliceAngle) * HALF_LATERAL_V;
  entity.half2vy = entity.vy + HALF_KICK_V;
  entity.half2rot = entity.rotation;
  entity.splashX = entity.x;
  entity.splashY = entity.y;
  entity.splashTimer = SPLASH_DURATION;
}

function sliceAngleFromTrail(trail: BladeTrail): number {
  const pts = trail.points;
  const n = pts.length;
  if (n < 2) return 0;
  const a = pts[n - 2]!;
  const b = pts[n - 1]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function GameScreen({onGameOver}: GameScreenProps): React.JSX.Element {
  const {width: screenW, height: screenH} = useWindowDimensions();

  // Pre-load all Skia images
  const images: Record<string, SkImage | null> = {
    apple: useImage(SPRITES.apple),
    apple_half_1: useImage(SPRITES.apple_half_1),
    apple_half_2: useImage(SPRITES.apple_half_2),
    banana: useImage(SPRITES.banana),
    banana_half_1: useImage(SPRITES.banana_half_1),
    banana_half_2: useImage(SPRITES.banana_half_2),
    orange: useImage(SPRITES.orange),
    orange_half_1: useImage(SPRITES.orange_half_1),
    orange_half_2: useImage(SPRITES.orange_half_2),
    coconut: useImage(SPRITES.coconut),
    coconut_half_1: useImage(SPRITES.coconut_half_1),
    coconut_half_2: useImage(SPRITES.coconut_half_2),
    pineapple: useImage(SPRITES.pineapple),
    pineapple_half_1: useImage(SPRITES.pineapple_half_1),
    pineapple_half_2: useImage(SPRITES.pineapple_half_2),
    watermelon: useImage(SPRITES.watermelon),
    watermelon_half_1: useImage(SPRITES.watermelon_half_1),
    watermelon_half_2: useImage(SPRITES.watermelon_half_2),
    bomb: useImage(SPRITES.bomb),
    explosion: useImage(SPRITES.explosion),
    splash_red: useImage(SPRITES.splash_red),
    splash_orange: useImage(SPRITES.splash_orange),
    splash_yellow: useImage(SPRITES.splash_yellow),
    background: useImage(SPRITES.background),
  };

  // Mutable game state — updated in the RAF loop without triggering re-renders
  const poolRef = useRef(new FruitPool());
  const trail0Ref = useRef<BladeTrail>(makeTrail('#00FFFF'));
  const trail1Ref = useRef<BladeTrail>(makeTrail('#FF6600'));
  const gameStateRef = useRef<GameState>({
    score: 0,
    lives: LIVES_START,
    isGameOver: false,
    frameCount: 0,
    spawnInterval: nextSpawnInterval(),
    nextSpawnAt: 60,
  });

  // React state for HUD and game over (only updated when these values change)
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [picture, setPicture] = useState<SkPicture>(() =>
    createPicture(() => {}),
  );

  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const gameLoop = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.isGameOver) return;

    gs.frameCount++;
    const pool = poolRef.current;
    const imgs = imagesRef.current;

    // Physics update
    let livesChanged = false;
    pool.forEachActive((e: FruitEntity) => {
      if (e.state === 'whole' || e.state === 'exploding') {
        e.vy += GRAVITY;
        e.x += e.vx;
        e.y += e.vy;
        e.rotation += e.rotationSpeed;
      } else if (e.state === 'sliced') {
        e.half1vy += GRAVITY;
        e.half1x += e.half1vx;
        e.half1y += e.half1vy;
        e.half1rot += e.rotationSpeed;
        e.half2vy += GRAVITY;
        e.half2x += e.half2vx;
        e.half2y += e.half2vy;
        e.half2rot -= e.rotationSpeed;
      }
      if (e.splashTimer > 0) e.splashTimer--;

      // Cull off-screen
      const refY = e.state === 'sliced'
        ? Math.max(e.half1y, e.half2y)
        : e.y;
      if (refY > screenH + 120) {
        if (e.state === 'whole') {
          gs.lives--;
          livesChanged = true;
        }
        pool.release(e);
      }
    });

    if (livesChanged) {
      setLives(gs.lives);
      if (gs.lives <= 0) {
        gs.isGameOver = true;
        onGameOver(gs.score);
        return;
      }
    }

    // Spawn fruits
    if (gs.frameCount >= gs.nextSpawnAt) {
      const n = burstCount();
      for (let i = 0; i < n; i++) {
        spawnFruit(pool, screenW, screenH);
      }
      gs.spawnInterval = nextSpawnInterval();
      gs.nextSpawnAt = gs.frameCount + gs.spawnInterval;
    }

    // Collision detection — two blade trails
    let scoreChanged = false;
    for (const trail of [trail0Ref.current, trail1Ref.current]) {
      if (!trail.active || trail.points.length < 2) continue;
      const angle = sliceAngleFromTrail(trail);
      pool.forEachActive((e: FruitEntity) => {
        if (e.state !== 'whole') return;
        if (!trailHitsCircle(trail, e.x, e.y, e.kind === 'bomb')) return;
        if (e.kind === 'bomb') {
          e.state = 'exploding';
          gs.isGameOver = true;
          onGameOver(gs.score);
        } else {
          sliceEntity(e, angle);
          gs.score++;
          scoreChanged = true;
        }
      });
    }
    if (scoreChanged) setScore(gs.score);

    // Build Skia picture
    const newPicture = createPicture(
      canvas => {
        drawBackground(canvas, imgs.background ?? null, screenW, screenH);
        pool.forEachActive((e: FruitEntity) => {
          drawFruit(canvas, e, imgs);
          if (e.splashTimer > 0 && e.kind !== 'bomb') {
            const splashKey = FRUIT_SPLASH_KEY[e.kind as FruitKind] ?? 'splash_red';
            drawSplash(canvas, e, imgs[splashKey] ?? null);
          }
        });
        drawBlade(canvas, trail0Ref.current);
        drawBlade(canvas, trail1Ref.current);
      },
      {x: 0, y: 0, width: screenW, height: screenH},
    );
    setPicture(newPicture);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [screenW, screenH, onGameOver]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [gameLoop]);

  // Multi-touch handlers — track up to 2 simultaneous fingers
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (touches[0]) {
      trail0Ref.current = {
        ...trail0Ref.current,
        points: [{x: touches[0].pageX, y: touches[0].pageY}],
        active: true,
      };
    }
    if (touches[1]) {
      trail1Ref.current = {
        ...trail1Ref.current,
        points: [{x: touches[1].pageX, y: touches[1].pageY}],
        active: true,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (touches[0]) {
      const t = trail0Ref.current;
      const pts = [...t.points, {x: touches[0].pageX, y: touches[0].pageY}];
      trail0Ref.current = {
        ...t,
        points: pts.slice(-TRAIL_MAX_POINTS),
        active: true,
      };
    }
    if (touches[1]) {
      const t = trail1Ref.current;
      const pts = [...t.points, {x: touches[1].pageX, y: touches[1].pageY}];
      trail1Ref.current = {
        ...t,
        points: pts.slice(-TRAIL_MAX_POINTS),
        active: true,
      };
    }
  }, []);

  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    const remaining = e.nativeEvent.touches.length;
    if (remaining === 0) {
      trail0Ref.current = {...trail0Ref.current, points: [], active: false};
      trail1Ref.current = {...trail1Ref.current, points: [], active: false};
    } else if (remaining === 1) {
      trail1Ref.current = {...trail1Ref.current, points: [], active: false};
    }
  }, []);

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onTouchStart}
      onResponderMove={onTouchMove}
      onResponderRelease={onTouchEnd}
      onResponderTerminate={onTouchEnd}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>
      <HUD score={score} lives={lives} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
