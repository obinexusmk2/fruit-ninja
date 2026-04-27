import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {Canvas, createPicture, Picture} from '@shopify/react-native-skia';
import {runMmukoBoot, type PhaseCallback} from './mmukoBoot';
import {
  PHASE_LABELS,
  MMUKO_BOOT_OUTCOME,
  type TrinaryState,
  type MmukoBootHandoff,
} from './types';
import {drawBootRing} from '../skia/drawBootRing';

interface BootScreenProps {
  onBootComplete: () => void;
}

interface PhaseEntry {
  phase: number;
  state: TrinaryState;
}

export function BootScreen({onBootComplete}: BootScreenProps): React.JSX.Element {
  const {width: screenW, height: screenH} = useWindowDimensions();
  const cx = screenW / 2;
  const cy = screenH / 2;

  const [phaseStates, setPhaseStates] = useState<Record<number, TrinaryState>>(
    {1: 'MAYBE', 2: 'MAYBE', 3: 'MAYBE', 4: 'MAYBE', 5: 'MAYBE', 6: 'MAYBE'},
  );
  const [handoff, setHandoff] = useState<MmukoBootHandoff | null>(null);
  const [completedPhases, setCompletedPhases] = useState(0);

  const angleRef = useRef(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const [picture, setPicture] = useState(() =>
    createPicture(canvas => {
      drawBootRing(canvas, cx, cy, 0, 0, screenW, screenH);
    }),
  );

  // Ring animation loop
  const animate = useCallback(() => {
    angleRef.current += 0.015;
    const angle = angleRef.current;
    const phases = completedPhases;
    setPicture(
      createPicture(canvas => {
        drawBootRing(canvas, cx, cy, angle, phases, screenW, screenH);
      }),
    );
    rafRef.current = requestAnimationFrame(animate);
  }, [cx, cy, screenW, screenH, completedPhases]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  // Run the MMUKO boot sequence on mount
  useEffect(() => {
    const onPhase: PhaseCallback = (phase, state) => {
      setPhaseStates(prev => ({...prev, [phase]: state}));
      if (state === 'YES') setCompletedPhases(phase);
    };

    runMmukoBoot(onPhase, 800).then(result => {
      setHandoff(result);
      setTimeout(() => onBootComplete(), 600);
    });
  }, [onBootComplete]);

  const isPassed = handoff?.outcome === MMUKO_BOOT_OUTCOME.PASS;

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>

      {/* Terminal HUD overlay */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.title}>MMUKO-OS RING BOOT v0.1 • NSIGII</Text>
        <Text style={styles.subtitle}>firmware_id: NSIGII | revision: 0x0001</Text>
        <View style={styles.divider} />
        {[1, 2, 3, 4, 5, 6].map(phase => {
          const state = phaseStates[phase] ?? 'MAYBE';
          const passed = state === 'YES';
          return (
            <Text
              key={phase}
              style={[styles.phase, passed ? styles.phaseYes : styles.phaseMaybe]}>
              {passed ? '✓' : '○'} {PHASE_LABELS[phase]} → {state}
            </Text>
          );
        })}
        {isPassed && (
          <>
            <View style={styles.divider} />
            <Text style={styles.passLine}>
              MMUKO_BOOT_OUTCOME = PASS (0xAA)
            </Text>
            <Text style={styles.passLine}>
              completed_phases: 6/6
            </Text>
            <Text style={styles.passLine}>
              validation_flags: 0x{handoff!.validationFlags.toString(16).padStart(8, '0').toUpperCase()}
            </Text>
            <Text style={styles.passLine}>
              handoff_checksum: 0x{handoff!.handoffChecksum.toString(16).toUpperCase()}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  hud: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderColor: '#00FFFF',
    borderWidth: 1,
    borderRadius: 4,
    padding: 14,
  },
  title: {
    fontFamily: 'monospace',
    color: '#00FFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'monospace',
    color: '#008888',
    fontSize: 11,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#00FFFF',
    opacity: 0.3,
    marginVertical: 6,
  },
  phase: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginVertical: 1,
  },
  phaseYes: {
    color: '#00FF00',
  },
  phaseMaybe: {
    color: '#FFFF00',
  },
  passLine: {
    fontFamily: 'monospace',
    color: '#00FF88',
    fontSize: 11,
    marginVertical: 1,
  },
});
