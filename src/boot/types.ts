// TypeScript port of pseudocode/mmuko-boot.psc

export const MMUKO_BOOT_OUTCOME = {
  PASS: 0xaa,
  HOLD: 0xbb,
  ALERT: 0xcc,
} as const;

export type MmukoBootOutcome =
  (typeof MMUKO_BOOT_OUTCOME)[keyof typeof MMUKO_BOOT_OUTCOME];

export type TrinaryState = 'YES' | 'NO' | 'MAYBE' | 'MAYBE_NOT';

export const PHASE_LABELS: Record<number, string> = {
  1: 'PHASE_NEED_STATE_INIT',
  2: 'PHASE_SAFETY_SCAN',
  3: 'PHASE_IDENTITY_CALIBRATION',
  4: 'PHASE_GOVERNANCE_CHECK',
  5: 'PHASE_INTERNAL_PROBE',
  6: 'PHASE_INTEGRITY_VERIFICATION',
};

export const PHASE_FLAGS: Record<number, number> = {
  1: 0x00000001,
  2: 0x00000002,
  3: 0x00000004,
  4: 0x00000008,
  5: 0x00000010,
  6: 0x00000020,
};

export interface MmukoBootHandoff {
  magic: 'MMKO';
  revision: 0x0001;
  firmwareId: 'NSIGII';
  outcome: MmukoBootOutcome;
  completedPhases: number;
  validationFlags: number;
  handoffChecksum: number;
}
