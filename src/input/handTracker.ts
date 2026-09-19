/**
 * Persistent hand identity.
 *
 * MediaPipe's per-frame output is an unordered list of hands with a handedness
 * LABEL. The label is a classifier output: it can flip between frames and it is
 * not an identity, and the list order can change when hands cross. So identity
 * is tracked here from position instead:
 *
 *  - each frame's detections are matched to existing tracks by predicted
 *    position (constant-velocity), minimising total distance, within a gate;
 *  - the label only breaks near-ties (a small penalty for disagreeing);
 *  - a track survives a short loss ("coasting") and keeps its id and blade slot
 *    if it reappears near where it should be; after that it expires and a new
 *    id is issued (ids are never reused);
 *  - a new track must be seen for `confirmFrames` frames before it counts, so a
 *    one-frame false detection never becomes a blade.
 *
 * Positions are in view (canvas) pixels, so the gate has a physical meaning.
 */

export interface Detection {
  x: number;
  y: number;
  /** MediaPipe label: 0 = Left, 1 = Right, -1 = unknown. A hint only. */
  handedness: number;
}

export interface TrackerConfig {
  /** Most simultaneous hands: 1 (one-hand mode) or 2. */
  maxHands: number;
  /** A detection farther than this (px) from a track's predicted position is never matched to it. */
  matchDistance: number;
  /** Consecutive matched frames before a new track is confirmed. */
  confirmFrames: number;
  /** How long a confirmed track may go unmatched and still be re-acquired (ms). */
  coastMs: number;
  /** Weight of the newest velocity sample, 0..1. */
  velocitySmoothing: number;
  /** Extra cost (px) when a detection's label disagrees with the track's label. */
  labelPenalty: number;
  /** Predictions never extrapolate further than this (ms). */
  maxPredictMs: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  maxHands: 2,
  matchDistance: 260,
  confirmFrames: 3,
  coastMs: 400,
  velocitySmoothing: 0.6,
  labelPenalty: 25,
  maxPredictMs: 100,
};

export interface Track {
  /** Unique, never reused. */
  id: number;
  /** Blade slot once confirmed (stable for the life of the track); null before. */
  slot: number | null;
  x: number;
  y: number;
  /** px per ms */
  vx: number;
  vy: number;
  lastT: number;
  hits: number;
  handedness: number;
  confirmed: boolean;
  /** True while a confirmed track is unmatched but still within coastMs. */
  coasting: boolean;
  /** True if the track was matched on the previous frame (a stroke is running). */
  streaming: boolean;
}

export interface TrackerFrame {
  /** Confirmed tracks matched this frame. `restart` = start a NEW stroke (first sample, or re-acquired). */
  active: Array<{id: number; slot: number; x: number; y: number; restart: boolean}>;
  /** Confirmed tracks that were streaming but were not matched this frame: end their strokes NOW. */
  lost: Array<{id: number; slot: number}>;
  /** Tracks removed this frame (coast expired / never confirmed). */
  expiredIds: number[];
  /** Confirmed hands currently matched. */
  confirmedCount: number;
}

interface Pairing {
  matches: Array<[number, number]>; // [trackIndex, detectionIndex]
  cost: number;
}

export class HandTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private slotsInUse = new Set<number>();

  constructor(private config: TrackerConfig = DEFAULT_TRACKER_CONFIG) {}

  setConfig(config: Partial<TrackerConfig>): void {
    this.config = {...this.config, ...config};
  }

  getTracks(): readonly Track[] {
    return this.tracks;
  }

  reset(): void {
    this.tracks = [];
    this.slotsInUse.clear();
  }

  /** Drops every confirmed stream at once (e.g. stale input): returns them so blades can be ended. */
  breakAll(): Array<{id: number; slot: number}> {
    const out: Array<{id: number; slot: number}> = [];
    for (const t of this.tracks) {
      if (t.confirmed && t.streaming && t.slot !== null) {
        out.push({id: t.id, slot: t.slot});
      }
      t.streaming = false;
      if (t.confirmed) {
        t.coasting = true;
      }
    }
    return out;
  }

  update(t: number, detections: readonly Detection[]): TrackerFrame {
    const cfg = this.config;
    const dets = detections.slice(0, cfg.maxHands);

    const predicted = this.tracks.map(tr => {
      const dt = Math.min(Math.max(t - tr.lastT, 0), cfg.maxPredictMs);
      return {x: tr.x + tr.vx * dt, y: tr.y + tr.vy * dt};
    });

    const best = this.bestPairing(predicted, dets);
    const matchedTracks = new Set<number>();
    const matchedDets = new Set<number>();
    const frame: TrackerFrame = {active: [], lost: [], expiredIds: [], confirmedCount: 0};

    // 1. Matched tracks: update kinematics, confirm, and report the sample.
    const newlyConfirmed: Track[] = [];
    for (const [ti, di] of best.matches) {
      matchedTracks.add(ti);
      matchedDets.add(di);
      const tr = this.tracks[ti]!;
      const d = dets[di]!;
      const dt = Math.max(t - tr.lastT, 1);
      const s = cfg.velocitySmoothing;
      // Only trust velocity across short gaps; after a long gap it is meaningless.
      const measurable = t - tr.lastT <= cfg.maxPredictMs;
      tr.vx = measurable ? s * ((d.x - tr.x) / dt) + (1 - s) * tr.vx : 0;
      tr.vy = measurable ? s * ((d.y - tr.y) / dt) + (1 - s) * tr.vy : 0;
      tr.x = d.x;
      tr.y = d.y;
      tr.lastT = t;
      tr.hits++;
      if (d.handedness >= 0) {
        tr.handedness = d.handedness;
      }
      const wasStreaming = tr.streaming;
      if (!tr.confirmed && tr.hits >= cfg.confirmFrames) {
        tr.confirmed = true;
        newlyConfirmed.push(tr);
      }
      tr.coasting = false;
      if (tr.confirmed) {
        tr.streaming = true;
        if (tr.slot !== null) {
          frame.active.push({id: tr.id, slot: tr.slot, x: tr.x, y: tr.y, restart: !wasStreaming});
        }
      }
    }

    // 2. Assign blade slots to tracks confirmed now (leftmost first, so slot 0 is the left hand).
    newlyConfirmed.sort((a, b) => a.x - b.x);
    for (const tr of newlyConfirmed) {
      const slot = this.freeSlot();
      if (slot === null) {
        // No blade available (more hands than blades): the track cannot be used.
        tr.confirmed = false;
        continue;
      }
      tr.slot = slot;
      this.slotsInUse.add(slot);
      frame.active.push({id: tr.id, slot, x: tr.x, y: tr.y, restart: true});
    }

    // 3. Unmatched tracks: confirmed ones coast (their stroke ends now); others die.
    const survivors: Track[] = [];
    for (let i = 0; i < this.tracks.length; i++) {
      const tr = this.tracks[i]!;
      if (matchedTracks.has(i)) {
        if (tr.confirmed || tr.hits < cfg.confirmFrames) {
          survivors.push(tr);
        } else {
          this.dropTrack(tr, frame);
        }
        continue;
      }
      if (tr.confirmed) {
        if (tr.streaming && tr.slot !== null) {
          frame.lost.push({id: tr.id, slot: tr.slot});
        }
        tr.streaming = false;
        tr.coasting = true;
        if (t - tr.lastT <= cfg.coastMs) {
          survivors.push(tr);
        } else {
          this.dropTrack(tr, frame);
        }
      } else {
        this.dropTrack(tr, frame); // an unconfirmed track missed a frame: discard
      }
    }
    this.tracks = survivors;

    // 4. Unmatched detections start new tentative tracks (respecting maxHands).
    for (let di = 0; di < dets.length; di++) {
      if (matchedDets.has(di)) {
        continue;
      }
      if (this.tracks.length >= cfg.maxHands) {
        continue;
      }
      const d = dets[di]!;
      this.tracks.push({
        id: this.nextId++,
        slot: null,
        x: d.x,
        y: d.y,
        vx: 0,
        vy: 0,
        lastT: t,
        hits: 1,
        handedness: d.handedness,
        confirmed: false,
        coasting: false,
        streaming: false,
      });
      // A one-frame confirmation threshold confirms immediately.
      const tr = this.tracks[this.tracks.length - 1]!;
      if (cfg.confirmFrames <= 1) {
        const slot = this.freeSlot();
        if (slot !== null) {
          tr.confirmed = true;
          tr.slot = slot;
          tr.streaming = true;
          this.slotsInUse.add(slot);
          frame.active.push({id: tr.id, slot, x: tr.x, y: tr.y, restart: true});
        }
      }
    }

    frame.confirmedCount = frame.active.length;
    return frame;
  }

  private dropTrack(tr: Track, frame: TrackerFrame): void {
    if (tr.slot !== null) {
      this.slotsInUse.delete(tr.slot);
    }
    frame.expiredIds.push(tr.id);
  }

  private freeSlot(): number | null {
    for (let s = 0; s < this.config.maxHands; s++) {
      if (!this.slotsInUse.has(s)) {
        return s;
      }
    }
    return null;
  }

  /** Minimum-cost matching (maximum matches first). Tiny problem: exhaustive search. */
  private bestPairing(
    predicted: ReadonlyArray<{x: number; y: number}>,
    dets: readonly Detection[],
  ): Pairing {
    const cfg = this.config;
    let best: Pairing = {matches: [], cost: 0};

    const cost = (ti: number, di: number): number | null => {
      const p = predicted[ti]!;
      const d = dets[di]!;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist > cfg.matchDistance) {
        return null;
      }
      const tr = this.tracks[ti]!;
      const label =
        tr.handedness >= 0 && d.handedness >= 0 && tr.handedness !== d.handedness
          ? cfg.labelPenalty
          : 0;
      return dist + label;
    };

    const recurse = (di: number, used: Set<number>, acc: Pairing): void => {
      if (di === dets.length) {
        if (
          acc.matches.length > best.matches.length ||
          (acc.matches.length === best.matches.length && acc.cost < best.cost)
        ) {
          best = {matches: [...acc.matches], cost: acc.cost};
        }
        return;
      }
      // Leave this detection unmatched.
      recurse(di + 1, used, acc);
      // Or match it to any free track within the gate.
      for (let ti = 0; ti < this.tracks.length; ti++) {
        if (used.has(ti)) {
          continue;
        }
        const c = cost(ti, di);
        if (c === null) {
          continue;
        }
        used.add(ti);
        acc.matches.push([ti, di]);
        acc.cost += c;
        recurse(di + 1, used, acc);
        acc.cost -= c;
        acc.matches.pop();
        used.delete(ti);
      }
    };
    recurse(0, new Set(), {matches: [], cost: 0});
    return best;
  }
}
