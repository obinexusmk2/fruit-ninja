# Android plan: architecture, decisions, tuning, traceability

Working branch `feature/android-hand-tracking`, started from `main` at
`20ecffddcba02cc4812c8c6f407b4802fe2a9bb7` (the reviewed commit; the tree was clean).
Status of each story is in [TODO.md](TODO.md); results are in
[TEST_EVIDENCE.md](TEST_EVIDENCE.md).

## 1. Architecture

```
                     ┌──────────────────────────── JavaScript (Hermes, Fabric) ───────────────────────────┐
 touch  ──►  TouchAdapter ──┐                                                                              │
                            ├─►  BladeSet (2 blades, ONE owner) ──►  GameSimulation ──►  GameScreen (Skia)  │
 camera ──►  HandAdapter ───┘        ▲                                   fixed step, scoring, lives         │
              ▲      │              └── HandTracker (identity), Calibration, ClockSync                      │
              │      └─ landmarkToCanvas: rotate → mirror once → cover/contain → canvas offset              │
              │  typed events (small numeric arrays: no frames, no base64)                                   │
 ─────────────┼──────────────────────────────────────────────────────────────────────────────────────────────
              │                              Android (Kotlin), modules/react-native-hands
   TurboModule FNHands ── HandsController (the ONLY camera owner)
        │                    ├─ CameraX: Preview + ImageAnalysis (RGBA_8888, KEEP_ONLY_LATEST, 4:3 both)
        │                    ├─ InFlightTracker (bounded), MonotonicTimestamps, session id on every callback
        │                    └─ HandDetector: MediaPipe HandLandmarker, LIVE_STREAM, numHands 1|2, CPU (GPU opt-in)
   Fabric FNHandCameraPreview ── PreviewView (COMPATIBLE/TextureView) → gives its surface to HandsController
```

* **One camera owner.** `HandsController` binds every CameraX use case. The preview
  view only hands it a surface. JavaScript never opens a camera or sees a frame.
* **One input owner.** `BladeSet.setOwner()` decides whether touch or hand samples may
  write the blades; writes from the other mode are rejected, and switching owner clears
  the trails.
* **Sessions.** Each native session has an id, announced in its first (`starting`)
  event. The adapter accepts only its own session's samples, so callbacks that outlive a
  restart are dropped (Kotlin checks its own session on every callback as well).
* **Simulation** (`src/game`) imports no React, Skia or camera code and is driven by
  explicit `advance(frameDeltaMs, nowMs)` calls.

### Coordinate contract (applied once each, in this order)

1. Native reports `landmarks` normalised to the **raw** analysis buffer plus that
   buffer's size and `rotationDegrees` (clockwise, makes it upright). MediaPipe takes the
   rotation as an ROI rotation and returns results in the *input image's own*
   coordinates. **This was wrong in the first version** (landmarks were assumed upright)
   and was found only with a live camera: the skeleton was drawn rotated and stretched.
2. JS rotates to upright, **mirrors x once** for the front camera (native never mirrors),
   scales into the view (`cover = max(vw/iw, vh/ih)` centre-crop, or `contain = min`),
   then adds the view's offset inside the canvas. `landmarkToCanvas` in
   `src/input/transforms.ts`, tested for portrait, landscape, both mirrors, rotation,
   letterbox and insets.
3. Blade anchor = midpoint of landmarks 8 (index tip) and 12 (middle tip), like the
   browser version.

Preview and analysis both use a 4:3 `ResolutionSelector`, so they share one field of
view and the same normalised coordinates hold for the preview.

### Time model

Rendering rate never changes gameplay: `advance()` consumes wall-clock deltas in fixed
1/120 s steps (30, 60 and 120 Hz give identical step counts and trajectories, tested),
clamps a delta to 100 ms and to 12 catch-up steps, and `resetTiming()` runs on resume.
Blade sample times are on the JS clock (`ClockSync` maps native elapsed-realtime by a
min-filter over the last 90 `receive - emit` samples).

**Latency endpoint (honest definition).** "Sample age" = time from the frame reaching
the analyzer (device elapsed-realtime) to the adapter applying it in JS (`receiveAge`).
It excludes sensor exposure/ISP time and display latency, so it is **not**
motion-to-photon latency. The p95 < 150 ms target is measured at this endpoint.

## 2. Tuning parameters

| Parameter | Default | Where | Effect |
| --- | --- | --- | --- |
| `maxSampleAgeMs` | 250 | `handAdapter.ts` | older frames are dropped and end every stroke |
| `staleMs` (watchdog) | 250 | `handAdapter.ts` | no accepted sample for this long clears all blades |
| `stableMs` | 700 | `calibration.ts` | continuous time the required hands must be seen before the countdown |
| `countdownSeconds` | 3 | `calibration.ts` | the browser used 8 s; 3 s suits a phone on a stand |
| `graceMs` | 250 | `calibration.ts` | a dropout shorter than this does not cancel lock/countdown |
| `pauseAfterLossMs` | 3000 | `useHandTracking.ts` | no confirmed hand this long while playing pauses the game |
| `confirmFrames` | 3 | `handTracker.ts` | frames before a new hand counts (rejects one-frame false hits) |
| `coastMs` | 400 | `handTracker.ts` | a lost hand keeps id and blade slot if it returns within this and the gate |
| `matchDistance` | max(120, 0.3 × view diagonal) px | `handAdapter.ts` | gate for re-associating a detection with a track |
| `labelPenalty` | 25 px | `handTracker.ts` | handedness label only breaks near-ties |
| `collisionWindowMs` | 120 touch / 240 hand | `constants.ts` | a segment slices only while its newer sample is this recent |
| `strokeGapMs` | 200 | `constants.ts` | a longer gap ends the stroke instead of bridging it |
| `minDetection/Tracking` | 0.65 | `handsClient.ts` | same as the browser version; presence 0.5 |
| `analysis size` | 640×480 (4:3) | `handsClient.ts` | closest supported size |
| `maxInFlight` | 1 | `handsClient.ts` | frames inside the detector at once (lowest latency) |
| `delegate` | `cpu` | `handsClient.ts` | GPU is opt-in until validated on physical devices |
| game type | Casual | `constants.ts` `DIFFICULTY_RULES` | lives, warm-up, bombs |
| `comboMin` / window | 3 fruit / 350 ms | `constants.ts` | fruit per swipe that double that swipe's score |
| `critChance` / bonus | 3 % / +10 | `constants.ts` | random critical hit |

Tuning advice: if hands flicker in dim light, raise `confirmFrames` or `coastMs`; if
slicing feels late, lower `maxInFlight` never below 1 and check `receiveAge` in the
`[hands:stats]` log (development builds print it every 2 s); if the game pauses too
eagerly, raise `pauseAfterLossMs`.

## 3. Decisions log

| # | Decision | Reason |
| --- | --- | --- |
| D1 | Local autolinked library `modules/react-native-hands` (TurboModule + Fabric view, codegen) | app-level Fabric components need custom C++ registration; a library is the well-trodden path and is a clean boundary |
| D2 | CameraX 1.6.2 and MediaPipe tasks-vision **1.0.0**, both pinned in `android/build.gradle` | API and native ABIs verified with `javap`/AAR inspection (arm64-v8a, armeabi-v7a, x86, x86_64; all 16 KB aligned); no `latest.release` |
| D3 | CPU delegate by default | GPU could not be validated on hardware (no physical device); auto-fallback code exists but is opt-in |
| D4 | No INTERNET permission in release (debug only, for Metro) | MediaPipe 1.0.0 always creates a usage logger that would send diagnostics through Google data-transport if a network path existed; removing the permission makes that impossible, and a build guard enforces it |
| D5 | JDK 21 for builds | Gradle 8.14.2 rejects JDK 25 |
| D6 | Default ABIs `armeabi-v7a,arm64-v8a,x86_64` (dropped 32-bit x86) | smaller bundle; arm64 is required, x86_64 covers emulators/Chromebooks |
| D7 | Countdown 3 s (browser: 8 s) | compact mobile flow; configurable |
| D8 | **Product decision (owner):** default **15 lives** ("Casual") with the original **3 lives** kept as "Challenge", plus Practice; a 10 s warm-up in Casual | "the game is too short"; the brief's "keep three starting lives" is preserved as the Challenge rule and one tap from Game Over |
| D9 | **Product decision (owner):** implement the mechanics of the referenced beginner's guide with original names and visuals | rules are not protected, names/art are; see the IP note in RELEASE_CHECKLIST |

### Beginner's-guide mechanics: what was and was not implemented

Implemented: game types (Casual / Challenge / Practice), combo (3+ fruit in one swipe
doubles that swipe's score), critical hit (+10 random). **Not implemented:** timed mode,
special bonus items (double score / slow time / fruit rush) and the combo-streak meter
(backlog B02), and, deliberately, purchasable power-ups, currencies, unlockable
blades/dojos, video rewards, multiplayer and tournaments: they need accounts,
networking or in-app purchases, which the privacy design excludes.

## 4. Requirements → files → tests

| Requirement | Files | Verified by |
| --- | --- | --- |
| Missed bomb costs no life | `game/simulation.ts` (`cull`) | `simulation.test.ts` "BOMB that falls out", `GameScreen.test.tsx` |
| Single terminal game-over; nothing after it | `simulation.ts` (`endGame`, `advance`) | `simulation.test.ts` "two bombs… exactly one", "nothing changes after game over" |
| One fruit scores once even if both blades cross | `simulation.ts` (entity-major `collide`) | `simulation.test.ts` "BOTH blades…" |
| Inside-circle / tangent / zero-length / high-speed | `game/collisionDetection.ts` | `collision.test.ts` |
| Trail segments expire by sample time | `collisionDetection.ts` (`findTrailHit`), `trail.ts` | `collision.test.ts`, `trail.test.ts` |
| Stable touch ids, canvas-local coordinates | `input/touchAdapter.ts`, `touchBinding.ts`, `GameScreen.tsx` (leaf touch surface) | `touch.test.ts`, `GameScreen.test.tsx` (`pageX` deliberately wrong) |
| Time independent of refresh rate | `simulation.ts` (`advance`) | `simulation.test.ts` 30/60/120 Hz |
| Scale to viewport | `game/config.ts`, `simulation.ts` (`resize`) | `simulation.test.ts` small/large phone, tablets |
| Pool exhaustion | `objectPool.ts`, `fruitSpawner.ts` | `simulation.test.ts` |
| One input owner | `input/bladeSet.ts`, `app/flow.ts` (`bladeOwner`) | `touch.test.ts`, `handAdapter.test.ts`, `flow.test.ts` |
| Coordinate transform (rotation, one mirror, crop, offsets) | `input/transforms.ts`, `handAdapter.ts` | `transforms.test.ts`, `handAdapter.test.ts` (raw rot 90/270 regression) |
| Hand identity across order changes, crossing, loss | `input/handTracker.ts` | `handTracker.test.ts`, `handAdapter.test.ts` |
| Stale / out-of-order / obsolete-session samples | `input/handAdapter.ts` | `handAdapter.test.ts` |
| No phantom slices (loss, stall, resume) | `handAdapter.ts`, `trail.ts`, `GameScreen.tsx` | `handAdapter.test.ts`, `GameScreen.test.tsx` |
| Calibrate, lock, countdown, cancel | `input/calibration.ts` | `calibration.test.ts`, `useHandTracking.test.tsx` |
| Pause on sustained loss; deliberate resume | `useHandTracking.ts`, `app/flow.ts` | `useHandTracking.test.tsx`, `flow.test.ts` |
| Permission states (denied, blocked, settings return, revoked/expired) | `camera/permissions.ts`, `setupState.ts`, `CameraSetupScreen.tsx` | `permissions.test.ts`, `CameraSetupScreen.test.tsx`; emulator (see evidence) |
| No front camera / camera disabled / model error | `Cameras.kt`, `ModelIntegrity.kt`, `setupState.ts` | `permissions.test.ts` (unit); **no front camera** also shown on an AVD without one; camera-disabled and model-error are unit only |
| Camera released when leaving hand mode / background | `useHandTracking.ts`, `HandsController.kt` | `useHandTracking.test.tsx`; emulator `dumpsys media.camera` |
| Rapid restart, obsolete callbacks | `HandsController.kt`, `useHandTracking.ts` | `useHandTracking.test.tsx`, Kotlin `InFlightTrackerTest`; emulator sessions 1 to 4 |
| Bounded in-flight, monotonic timestamps | `core/InFlightTracker.kt`, `MonotonicTimestamps.kt` | Kotlin JVM tests |
| Every `ImageProxy` closed; pixels copied before close | `HandsController.kt` (`FrameAnalyzer`) | code review + `errors: 0` over ~1,500 frames |
| Model bundled with checksum and attribution | `assets/hand_landmarker.task(.sha256)`, `build.gradle` gate, `ModelIntegrity.kt`, `THIRD_PARTY_NOTICES.md` | build gate; runtime check in `getCapabilities` |
| CAMERA permission, optional camera features, no INTERNET in release | `AndroidManifest.xml`, `src/release/`, `build.gradle` guard | merged manifests (evidence) |
| Signing from private config, no debug fallback | `android/app/build.gradle` | `bundleRelease` without key fails in 6 s (evidence) |
| 16 KB page size | `scripts/check-elf-page-size.mjs` | debug and release artifacts (evidence); run on a 16 KB emulator |
| Casual 15 lives / Challenge 3 / Practice; warm-up | `game/constants.ts`, `config.ts`, `simulation.ts`, `ui/HomeScreen.tsx`, `GameOver.tsx` | `scoring.test.ts`, `difficulty.test.tsx`, `flow.test.ts` |
| Combos and critical hits | `simulation.ts` (`scoreExtras`), `GameScreen.tsx` (banner) | `scoring.test.ts`, `difficulty.test.tsx` |
| Boot presentation is decorative, brief, skippable, reduced-motion aware | `boot/*` | `App.test.tsx`; emulator |
| Accessible UI (labels, large targets, live regions) | `ui/*`, `camera/*` | emulator UI-hierarchy dumps; `difficulty.test.tsx`; no TalkBack run |
| Adaptive layout: 600 dp readable column on tablets/landscape, side insets, no HUD control under the calibration overlay | `ui/theme.ts` (`contentColumn`), the five menu screens, `camera/CalibrationOverlay.tsx`, `game/GameScreen.tsx` (`showHud`), `app/GameStage.tsx` | `layout.test.tsx` (mutation-checked); tablet emulator, both orientations |

## 5. Sprint reviews and retrospectives (brief)

**Sprint 0 (A01).** Reproduced the build after installing JDK 21 and the SDK pieces
(with approval). *Went well:* the failures were cheap to find (`Unsupported class file
major version 69`). *Change:* record every download with source and checksum.

**Sprint 1 (A02, A03).** Failing-first tests reproduced three reported defects on
`20ecffd`, plus a fourth found on the way (the original component re-creates its object
pool on every render). *Learned:* a scripted `Math.random` cannot reproduce bugs in a
component that re-runs initialisers, so stub the seam instead.

**Sprint 2 (A04, A05).** Native slice compiled first time; real hands worked on the
emulator webcam. The live test caught the coordinate bug that 87 unit tests could not,
because the tests encoded the same wrong assumption. *Change:* a contract that unit
tests share with the implementation still needs a live check; the raw-landmark log
line (`[hands:raw]`) was added for that.

**Sprint 3 and 4.** Release build, privacy finding (MediaPipe usage logger) and its
no-network mitigation, then a release smoke pass on a small-phone and a tablet AVD. *Went
well:* the tablet pass found three layout defects that 250 unit tests did not (edge-to-edge
menus, HUD under the calibration overlay, ignored side insets), each now fixed with a
regression test. *Change:* run every screen on at least one large-screen emulator before
calling a UI story done. See TODO.md for what is done, blocked and open. Physical-device
work (A07, parts of A04/A05, GPU) is blocked on hardware.
