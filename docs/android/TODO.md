# Story board

Columns: **Backlog → Ready → In progress → Review → Done**, plus **Blocked** (always with
a concrete reason). One story is actively implemented at a time; points are *relative*
story points, not dates, and were re-estimated after the baseline (see "Re-estimate").
"Done" means the acceptance evidence was exercised, not that files exist. Evidence lives
in [TEST_EVIDENCE.md](TEST_EVIDENCE.md).

Last updated at the end of this working session (19 September 2026).

## Done

| ID | Story | Evidence |
| --- | --- | --- |
| **A01** (3) | Reproduce the existing Android build | `npm ci` ok; baseline tsc ok, lint **1 error**, Jest **failing**; debug build under JDK 25 failed (`Unsupported class file major version 69`); after JDK 21 + SDK 36/NDK/CMake: `assembleDebug` (4 ABIs) **BUILD SUCCESSFUL in 11m55s**, 220.9 MB debug APK. Hard-coded developer NDK path removed. |
| **A02** (5) | Correct, consistent touch gameplay | 3 defects reproduced failing on `20ecffd` (inside-circle miss, missed bomb costs a life, `onGameOver` called twice), then fixed with regression tests; a 4th defect found (pool rebuilt every render). Touch session on the AVD: score 10 in ~5 s of swipes; pause, background, resume, game over, home, privacy, Back all exercised. |
| **A03** (3) | Player controls camera access | Emulator: explanation before any prompt, deny, deny again (blocked), Settings round trip, camera released on Cancel and on background; on the release build (tablet AVD) Allow, the system dialog, calibration, rotation with the camera kept, and release on Cancel. The **no-front-camera** screen was shown on an AVD without a front camera. Camera-disabled and model-error states are **unit-tested only**. |
| **B01** (3) | Owner request: 15 lives + easy way into the 3-life challenge; beginner's-guide mechanics | Casual/Challenge/Practice, warm-up, combos, criticals: 30+ tests; Home picker and Game Over switch on the emulator; a real user round on the emulator lasted 43 s and scored 59 (vs ~4 s idle before). |

## Review (implemented and tested; acceptance not fully met, gap stated)

| ID | Story | What is proven | Gap to close |
| --- | --- | --- | --- |
| **A04** (8) | Real hands move two independent blades | Live camera → CameraX → MediaPipe (x86_64, CPU) → JS on the emulator with a **real webcam and real hands**: ~960 results, 0 errors, sessions 1–4, blades follow the fingertips (score 12 with two hands). Found and fixed a coordinate-contract bug with live data. | **Physical-phone demo** (blocked: none attached). **Skeleton alignment after the fix is not confirmed visually**: the raw log confirms the numbers (rot 90, 640×480: the wrist maps to the bottom edge, fingertips above it), but the last screenshot watcher timed out after 20 minutes without a calibration lock. Someone should look at the overlay once on a debug build. GPU delegate unvalidated. |
| **A05** (5) | Calibrate, lose tracking, recover fairly | Unit: identity across order/crossing/loss, stale and out-of-order rejection, cancel/restart calibration, no phantom slices. Emulator: calibration → countdown → play with real hands, repeated restarts. | Rotation and resume on a physical device; a recorded pause-on-loss run. |
| **A06** (5) | Adaptive UI, reduced motion, accessible menus | Safe insets on every screen, ≥ 48 dp targets (56 dp buttons, 52 dp pause + 8 dp slop), labels/roles/live regions, reduce-motion toggle, `maxFontSizeMultiplier`, one-hand mode, menus in a 600 dp column. Exercised on emulators: 360×640 dp, 448×997 dp, 1280×800 dp and 800×1280 dp (rotation with the camera kept), font scale 2.0 on Home. Found and fixed with tests: stretched tablet menus, HUD under the calibration overlay, ignored side insets. | **No TalkBack traversal was run**; font scale checked on Home only; reduce-motion visual effect checked in unit tests, not by eye; real-hand play on a tablet or in landscape not exercised; nothing on a physical device. |
| **A08** (5) | Release candidate | Signing from private config (fails at once without it, verified), network-permission guard, version/app-ID by property. Release APK + AAB built with a **throwaway local key** (8m43s first build, 26 to 28 s rebuilds); 16 KB check **54 libraries, 36 64-bit, 0 failing** on both; merged permissions **CAMERA only**, camera and `screen.portrait` features optional; release process has **no network group**; smoke-tested offline on a small phone and a tablet AVD (TEST_EVIDENCE section 10). | The real upload key, original title and application ID, privacy policy hosting, store listing, ratings, test-track requirement: all owner actions (see RELEASE_CHECKLIST). |

## In progress

Nothing is being worked on: what is left is either a review gap above or blocked below.

## Blocked

| ID | Story | Reason |
| --- | --- | --- |
| **A07** (5) | Reliable sessions: profile, soak | **No physical Android device is attached**, and the brief requires physical-device metrics (60 Hz frame times, thermal, 10-minute run). Emulator numbers exist but are not device numbers. |
| A04/A05 physical | Physical-phone demo and rotation/resume checks | Same: no device. |
| GPU delegate | Validate `delegate: 'gpu'` and the auto fallback | Needs physical GPUs; the default stays CPU. |
| API 36 emulation | Run on an API 36 image | You declined the ~1.5 GB image download; the AVD is API **37.1** (16 KB pages). `targetSdk` is 36. |
| Play publishing | Upload, internal testing, closed test | Out of scope by instruction; also needs the owner's Play account (see RELEASE_CHECKLIST). |

## Backlog / Ready

| ID | Story | State | Acceptance |
| --- | --- | --- | --- |
| **B02** (5) | Timed mode with bonus items (double score, slow time, fruit rush) and combo-streak meter | Ready | 60 s timer; items appear as glowing fruit (original art, not banana lookalikes); effects have durations and are unit-tested; no network/IAP |
| **B03** (2) | Landscape/tablet layout pass with screenshots | Mostly done (A06) | verified with `uiautomator` bounds and screenshots at 360×640, 448×997, 1280×800 and 800×1280 dp; exact 320×640 and 412×915 not run; screenshots are kept out of the repository (store-listing captures are B07) |
| **B04** (3) | Persist settings (difficulty, one-hand, reduce motion) | Backlog | needs a storage decision (SharedPreferences via the native module avoids a new dependency) |
| **B05** (2) | Haptics device check | Backlog | `performHapticFeedback` used (no permission); verify on a physical phone |
| **B06** (3) | License audit of `assets/`, icons, fonts, sounds; replace what is not cleared | Backlog, release-blocking | recorded provenance for every asset |
| **B07** (3) | Original title, icon, screenshots of the real build | Backlog, release-blocking | owner-approved |

## Re-estimate after baseline

A01 was a 3 but took the toolchain provisioning (JDK 21, SDK, NDK, CMake) plus a 12-minute
first build, so treat first-time environment setup as its own 3-point item. A04 stayed at
8 but split naturally into "native slice compiles" (done in one build) and "real-hand
verification" (took the longest, because the live check found a real bug). A07 grows from
5 to 8 because every measurement needs a physical device.

## Definition of done reminders

* No test was weakened to get a green result. Two baseline tests were **fixed** (the
  Jest suite crashed the process by not stopping timers; a Jest mock was missing).
* Mock camera and landmark fixtures appear only in unit tests; acceptance claims above
  cite only real-camera runs.
