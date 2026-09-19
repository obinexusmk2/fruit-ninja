/**
 * Calibration: "raise your hands" -> stable lock -> countdown -> play.
 *
 * The countdown may only start after the required number of hands has been seen
 * CONTINUOUSLY for `stableMs`; a brief flicker never starts it. If a required
 * hand disappears for longer than `graceMs`, the calibration is cancelled and
 * starts over from scanning (also during the countdown).
 *
 * All timings are configurable; defaults and tuning advice live in
 * docs/android/PLAN.md.
 */

export interface CalibrationConfig {
  /** Hands that must be visible: 2, or 1 in one-hand mode. */
  requiredHands: number;
  /** Continuous time the required hands must be visible before the countdown. */
  stableMs: number;
  /** Countdown length in whole seconds (the browser version used 8). */
  countdownSeconds: number;
  /** A gap shorter than this does not cancel the lock or the countdown. */
  graceMs: number;
}

export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  requiredHands: 2,
  stableMs: 700,
  countdownSeconds: 3,
  graceMs: 250,
};

export type CalibrationPhase = 'scanning' | 'locking' | 'countdown' | 'done';

export interface CalibrationState {
  phase: CalibrationPhase;
  handsVisible: number;
  required: number;
  /** Progress through the stable-lock period, 0..1 (1 once locked). */
  lockProgress: number;
  /** Whole seconds left in the countdown (3,2,1), 0 outside it. */
  countdownRemaining: number;
}

export class Calibration {
  private phase: CalibrationPhase = 'scanning';
  private lockStart = 0;
  private countdownEnd = 0;
  private belowSince: number | null = null;

  constructor(private config: CalibrationConfig = DEFAULT_CALIBRATION_CONFIG) {}

  setConfig(config: Partial<CalibrationConfig>): void {
    this.config = {...this.config, ...config};
  }

  reset(): void {
    this.phase = 'scanning';
    this.lockStart = 0;
    this.countdownEnd = 0;
    this.belowSince = null;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /**
   * Advances the state machine.
   * @param nowMs clock time
   * @param confirmedHands confirmed (stable) hands currently tracked
   */
  update(nowMs: number, confirmedHands: number): CalibrationState {
    const cfg = this.config;
    const enough = confirmedHands >= cfg.requiredHands;

    if (this.phase === 'done') {
      return this.snapshot(nowMs, confirmedHands);
    }

    if (enough) {
      this.belowSince = null;
    } else if (this.phase !== 'scanning') {
      if (this.belowSince === null) {
        this.belowSince = nowMs;
      }
      if (nowMs - this.belowSince > cfg.graceMs) {
        // Required hand(s) gone too long: cancel and restart calibration.
        this.phase = 'scanning';
        this.belowSince = null;
      }
    }

    switch (this.phase) {
      case 'scanning':
        if (enough) {
          this.phase = 'locking';
          this.lockStart = nowMs;
        }
        break;
      case 'locking':
        if (enough && nowMs - this.lockStart >= cfg.stableMs) {
          this.phase = 'countdown';
          this.countdownEnd = nowMs + cfg.countdownSeconds * 1000;
        }
        break;
      case 'countdown':
        if (nowMs >= this.countdownEnd) {
          this.phase = 'done';
        }
        break;
    }
    return this.snapshot(nowMs, confirmedHands);
  }

  private snapshot(nowMs: number, hands: number): CalibrationState {
    const cfg = this.config;
    return {
      phase: this.phase,
      handsVisible: hands,
      required: cfg.requiredHands,
      lockProgress:
        this.phase === 'scanning'
          ? 0
          : this.phase === 'locking'
          ? Math.min(1, (nowMs - this.lockStart) / cfg.stableMs)
          : 1,
      countdownRemaining:
        this.phase === 'countdown'
          ? Math.max(1, Math.ceil((this.countdownEnd - nowMs) / 1000))
          : 0,
    };
  }
}
