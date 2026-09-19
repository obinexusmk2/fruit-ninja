/**
 * Viewport-independent gameplay tuning. Distances that depend on the screen are
 * derived from these fractions in config.ts, so the same game feels the same on
 * a small phone, a large phone and a tablet.
 *
 * Time is in milliseconds and speeds are in px/s (or viewport-relative fractions
 * per second). Nothing here depends on the display refresh rate.
 */
export const LIVES_START = 3;
export const POOL_SIZE = 32;
export const BOMB_CHANCE = 0.07;

export const FRUIT_KINDS = [
  'apple',
  'banana',
  'orange',
  'coconut',
  'pineapple',
  'watermelon',
] as const;

/** Fixed simulation step. 1/120 s divides evenly into 30, 60 and 120 Hz frames. */
export const FIXED_STEP_MS = 1000 / 120;
/** Frame deltas above this are clamped: a stall must not fast-forward physics. */
export const MAX_FRAME_DELTA_MS = 100;
/** Hard cap on catch-up steps per frame so a slow frame cannot spiral. */
export const MAX_STEPS_PER_ADVANCE = 12;

/** Blade trail behaviour (sample time based, not frame based). */
export const TRAIL_MAX_POINTS = 20;
/** A segment can slice only while its newest sample is younger than this. */
export const COLLISION_WINDOW_MS = 120;
/** Trail samples older than this are dropped from the drawn trail. */
export const TRAIL_VISUAL_TTL_MS = 260;
/** A gap this long between samples ends the stroke instead of bridging it. */
export const STROKE_GAP_MS = 200;
/** Segments shorter than this (px) are treated as zero-length and never slice. */
export const MIN_SEGMENT_LENGTH_PX = 0.5;

/** Spawner timing. The original ran 50-90 frames at 60 Hz. */
export const FIRST_SPAWN_DELAY_MS = 1000;
export const SPAWN_INTERVAL_MIN_MS = 833;
export const SPAWN_INTERVAL_MAX_MS = 1500;
export const SPAWN_BURST_MIN = 1;
export const SPAWN_BURST_MAX = 3;

/** Physical layout, as fractions of the viewport (see createGameConfig). */
export const GRAVITY_PER_HEIGHT = 0.95; // viewport heights / s^2
export const APEX_MIN = 0.55; // launch apex, fraction of viewport height
export const APEX_MAX = 0.85;
export const LAUNCH_VX_PER_WIDTH = 0.12; // viewport widths / s
export const FRUIT_RADIUS_PER_UNIT = 0.115;
export const BOMB_RADIUS_RATIO = 0.905;
export const HALF_LATERAL_PER_UNIT = 0.58;
export const HALF_KICK_PER_UNIT = 0.42;
export const SPLASH_DURATION_MS = 367;
export const MAX_ROTATION_SPEED = 6; // rad/s
