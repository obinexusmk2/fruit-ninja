/**
 * Which input source currently drives the blades. Exactly one mode owns the
 * gameplay trails at a time (see BladeSet).
 */
export type InputMode = 'touch' | 'hand';

/** 0 = first blade (cyan), 1 = second blade (orange). */
export type BladeSlot = 0 | 1;

export const BLADE_COLORS: readonly string[] = ['#00FFFF', '#FF6600'];

/** How many hands/fingers drive blades: 2 normally, 1 in one-hand mode. */
export type BladeCount = 1 | 2;

export interface Point {
  x: number;
  y: number;
}

/** Monotonic millisecond clock shared by input adapters and the simulation. */
export type Clock = () => number;

/**
 * performance.now() when available (Hermes provides it), else Date.now().
 * The global is looked up on every call, not captured, so test fake timers
 * that replace it are honoured.
 */
export const defaultClock: Clock = () => {
  const perf = (globalThis as {performance?: {now(): number}}).performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
};
