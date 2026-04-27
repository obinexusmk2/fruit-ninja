import {
  MMUKO_BOOT_OUTCOME,
  PHASE_FLAGS,
  type MmukoBootHandoff,
  type TrinaryState,
} from './types';

export type PhaseCallback = (phase: number, state: TrinaryState) => void;

// Simple CRC32 over a string representation of key handoff fields
function crc32(str: string): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ (table[(crc ^ str.charCodeAt(i)) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Runs the 6-phase MMUKO boot sequence.
// Each phase emits MAYBE (uncertainty) then YES (resolved), matching the trinary algebra.
export async function runMmukoBoot(
  onPhase: PhaseCallback,
  phaseDelayMs = 800,
): Promise<MmukoBootHandoff> {
  const handoff: MmukoBootHandoff = {
    magic: 'MMKO',
    revision: 0x0001,
    firmwareId: 'NSIGII',
    outcome: MMUKO_BOOT_OUTCOME.HOLD,
    completedPhases: 0,
    validationFlags: 0,
    handoffChecksum: 0,
  };

  for (let phase = 1; phase <= 6; phase++) {
    onPhase(phase, 'MAYBE');
    await delay(phaseDelayMs / 2);
    onPhase(phase, 'YES');
    await delay(phaseDelayMs / 2);
    handoff.completedPhases = phase;
    handoff.validationFlags |= PHASE_FLAGS[phase] ?? 0;
  }

  handoff.outcome = MMUKO_BOOT_OUTCOME.PASS;
  const key = `${handoff.magic}|${handoff.revision}|${handoff.firmwareId}|${handoff.outcome}|${handoff.completedPhases}|${handoff.validationFlags}`;
  handoff.handoffChecksum = crc32(key);

  return handoff;
}
