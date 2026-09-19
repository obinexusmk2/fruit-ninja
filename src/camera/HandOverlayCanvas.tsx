import React, {useEffect, useState} from 'react';
import {StyleSheet} from 'react-native';
import {Canvas, createPicture, Picture} from '@shopify/react-native-skia';
import type {SkPicture} from '@shopify/react-native-skia';
import type {HandAdapter} from '../input/handAdapter';
import {drawHands} from '../skia/drawHands';

interface Props {
  adapter: HandAdapter;
  width: number;
  height: number;
}

/**
 * Skeleton overlay. It redraws only when a new sample arrives (camera rate),
 * reads the adapter directly, and never causes app-level React updates.
 */
export function HandOverlayCanvas({adapter, width, height}: Props): React.JSX.Element {
  const [picture, setPicture] = useState<SkPicture | null>(null);

  useEffect(() => {
    let raf: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastDrawn: number | null = null;
    const loop = () => {
      const overlay = adapter.getOverlay();
      const t = overlay ? overlay.t : null;
      if (t !== lastDrawn) {
        lastDrawn = t;
        setPicture(
          createPicture(canvas => drawHands(canvas, overlay), {
            x: 0,
            y: 0,
            width,
            height,
          }),
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
      }
    };
  }, [adapter, width, height]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {picture ? <Picture picture={picture} /> : null}
    </Canvas>
  );
}
