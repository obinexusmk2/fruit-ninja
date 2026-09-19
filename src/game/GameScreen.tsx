import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {Canvas, createPicture, Picture, useImage} from '@shopify/react-native-skia';
import type {SkImage, SkPicture} from '@shopify/react-native-skia';
import {GameSimulation} from './simulation';
import {drawBackground, drawCameraWash} from '../skia/drawBackground';
import {drawBlade} from '../skia/drawBlade';
import {drawFruit, drawSplash} from '../skia/drawFruit';
import {SPRITES, FRUIT_SPLASH_KEY} from './assets';
import type {FruitEntity, FruitKind, GameOverReason, SimEvent} from './types';
import {LIVES_START} from './constants';
import {HUD} from '../ui/HUD';
import {noHaptics, type Haptics} from '../ui/haptics';
import type {BladeSet} from '../input/bladeSet';
import {TouchAdapter, type TouchPhase} from '../input/touchAdapter';
import {touchInputFromEvent, type RawTouchEvent} from '../input/touchBinding';
import {defaultClock, type BladeCount, type Clock, type InputMode} from '../input/types';

/** Longest we wait for sprites before starting anyway. */
export const ASSET_WAIT_TIMEOUT_MS = 5000;

export interface GameScreenProps {
  /** Shared blade trails; the input layer writes them, this screen reads them. */
  blades: BladeSet;
  mode: InputMode;
  /** false while paused or calibrating: the loop stops and timing is reset on resume. */
  running: boolean;
  /** 'image' draws the game background; 'camera' leaves the canvas transparent over the preview. */
  backdrop: 'image' | 'camera';
  bladeCount?: BladeCount;
  reducedMotion?: boolean;
  haptics?: Haptics;
  /** Called exactly once per game, when the game ends. */
  onGameOver: (score: number, reason: GameOverReason) => void;
  onPause?: () => void;
  clock?: Clock;
  /** Test hook: deterministic random source. */
  rng?: () => number;
}

function useSprites(): Record<string, SkImage | null> {
  return {
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
}

export function GameScreen({
  blades,
  mode,
  running,
  backdrop,
  bladeCount = 2,
  reducedMotion = false,
  haptics = noHaptics,
  onGameOver,
  onPause,
  clock = defaultClock,
  rng = Math.random,
}: GameScreenProps): React.JSX.Element {
  const images = useSprites();
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Do not start the clock until the sprites exist: otherwise fruit could be
  // invisible (and cost lives) while assets are still loading, which happens
  // in debug builds where sprites are fetched from Metro. A timeout keeps one
  // broken asset from blocking the game forever.
  const spritesLoaded = Object.values(images).every(Boolean);
  const [assetWaitExpired, setAssetWaitExpired] = useState(false);
  useEffect(() => {
    if (spritesLoaded) {
      return;
    }
    const id = setTimeout(() => setAssetWaitExpired(true), ASSET_WAIT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [spritesLoaded]);
  const assetsReady = spritesLoaded || assetWaitExpired;

  // Mutable game objects live in refs so the frame loop never triggers a
  // re-render by itself. Lazily created (a plain `useRef(new X())` would
  // construct a new object on EVERY render).
  const simRef = useRef<GameSimulation | null>(null);
  const touchRef = useRef<TouchAdapter | null>(null);
  const [ready, setReady] = useState(false);
  const sizeRef = useRef({width: 0, height: 0});

  const [hud, setHud] = useState({score: 0, lives: LIVES_START});
  const hudRef = useRef(hud);
  const [picture, setPicture] = useState<SkPicture | null>(null);

  const gameOverSent = useRef(false);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Props read inside the loop are mirrored into refs so the loop is stable.
  const propsRef = useRef({onGameOver, haptics, reducedMotion, backdrop, mode});
  propsRef.current = {onGameOver, haptics, reducedMotion, backdrop, mode};

  if (!touchRef.current) {
    touchRef.current = new TouchAdapter(blades, bladeCount);
  }

  useEffect(() => {
    touchRef.current?.setBladeCount(bladeCount);
  }, [bladeCount]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const {width, height} = e.nativeEvent.layout;
      if (width <= 0 || height <= 0) {
        return;
      }
      sizeRef.current = {width, height};
      if (!simRef.current) {
        simRef.current = new GameSimulation({width, height}, blades.trails, rng);
        setReady(true);
      } else {
        simRef.current.resize({width, height});
      }
    },
    [blades, rng],
  );

  const handleEvents = useCallback((sim: GameSimulation, events: SimEvent[]) => {
    const {haptics: h, onGameOver: over} = propsRef.current;
    for (const ev of events) {
      if (ev.type === 'slice') {
        h.slice();
      } else if (ev.type === 'bomb') {
        h.bomb();
      } else if (ev.type === 'miss') {
        h.miss();
      } else if (ev.type === 'gameover' && !gameOverSent.current) {
        gameOverSent.current = true;
        over(ev.score, ev.reason);
      }
    }
    const {score, lives} = sim.state;
    if (hudRef.current.score !== score || hudRef.current.lives !== lives) {
      hudRef.current = {score, lives};
      setHud(hudRef.current);
    }
  }, []);

  const buildPicture = useCallback((sim: GameSimulation): SkPicture => {
    const cfg = sim.getConfig();
    const {width, height} = cfg.viewport;
    const imgs = imagesRef.current;
    const p = propsRef.current;
    const bladeScale = cfg.unit / 360;
    return createPicture(
      canvas => {
        if (p.backdrop === 'image') {
          drawBackground(canvas, imgs.background ?? null, width, height);
        } else {
          drawCameraWash(canvas, width, height);
        }
        sim.pool.forEachActive((e: FruitEntity) => {
          drawFruit(canvas, e, imgs, cfg.spriteSize, p.reducedMotion);
          if (
            !p.reducedMotion &&
            e.splashTimer > 0 &&
            e.kind !== 'bomb' &&
            e.state === 'sliced'
          ) {
            const key = FRUIT_SPLASH_KEY[e.kind as FruitKind] ?? 'splash_red';
            drawSplash(canvas, e, imgs[key] ?? null, cfg.spriteSize, cfg.splashDurationMs);
          }
        });
        for (const trail of blades.trails) {
          drawBlade(canvas, trail, bladeScale);
        }
      },
      {x: 0, y: 0, width, height},
    );
  }, [blades]);

  // The frame loop. It runs only while `running`; every (re)start discards the
  // time spent paused and any stale blade segments.
  useEffect(() => {
    const sim = simRef.current;
    if (!running || !ready || !assetsReady || !sim) {
      return;
    }
    lastFrameRef.current = null;
    sim.resetTiming();
    blades.clear(); // no stale segments may survive a pause/resume

    const loop = () => {
      const now = clock();
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      const delta = last === null ? 0 : now - last;

      blades.prune(now);
      sim.advance(delta, now);
      handleEvents(sim, sim.drainEvents());
      setPicture(buildPicture(sim));

      if (sim.state.phase === 'running') {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, ready, assetsReady, blades, clock, handleEvents, buildPicture]);

  // Pausing or leaving the screen must not leave a finger stroke behind.
  useEffect(() => {
    if (!running) {
      touchRef.current?.cancelAll();
    }
  }, [running]);
  useEffect(
    () => () => {
      touchRef.current?.cancelAll();
    },
    [],
  );

  // Stable handlers (built once per clock) so the touch view is not re-created
  // on every frame.
  const touchHandlers = useMemo(() => {
    const make = (phase: TouchPhase) => (e: NativeSyntheticEvent<unknown>) => {
      touchRef.current?.handle(
        touchInputFromEvent(phase, e.nativeEvent as RawTouchEvent, clock()),
      );
    };
    return {
      onTouchStart: make('start'),
      onTouchMove: make('move'),
      onTouchEnd: make('end'),
      onTouchCancel: make('cancel'),
    };
  }, [clock]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {picture ? <Picture picture={picture} /> : null}
      </Canvas>
      {mode === 'touch' ? (
        // A leaf view exactly over the canvas: locationX/Y are canvas-local.
        <View
          style={StyleSheet.absoluteFill}
          {...touchHandlers}
          importantForAccessibility="no"
          testID="touch-surface"
        />
      ) : null}
      <HUD score={hud.score} lives={hud.lives} livesMax={LIVES_START} onPause={onPause} />
      {!assetsReady ? (
        <View style={styles.loading} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.loadingText}>LOADING</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent so the camera preview (a sibling behind this screen) shows
    // through in hand mode; the touch background is drawn by the canvas.
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'monospace',
    fontSize: 18,
    letterSpacing: 4,
    color: '#00FFFF',
  },
});
