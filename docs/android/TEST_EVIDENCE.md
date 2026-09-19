# Test evidence

Every result below was produced by running the command shown, on the machine shown.
Nothing here is invented, estimated from documentation, or carried over from another
project. Where something was **not** verified, it says so. Raw logs of the baseline runs
are in [`evidence/`](evidence/).

**What each kind of evidence means (none implies another):**

| Level | Meaning here |
| --- | --- |
| Source review | reading code; the reviewed commit was `20ecffd` |
| Build | Gradle produced the artifact |
| Emulator | ran on the Android Emulator (x86_64, API 37.1, 16 KB pages) |
| Physical device | **none performed: no device was attached** |
| Play approval | **none: nothing was uploaded** |

## 1. Environment

| Item | Value |
| --- | --- |
| Host | Windows 11 Home 10.0.26200, AMD Ryzen 9 8945HS (8C/16T), 31.2 GB RAM |
| Node / npm / git | 26.7.0 / 11.19.0 / 2.55.0.windows.5 (PowerShell 7.6.6) |
| JDKs found | Oracle 25.0.4.1 (on PATH; **incompatible**), Android Studio JBR 25.0.2 |
| JDK used for builds | Eclipse Temurin **21.0.12.1+1** in `%USERPROFILE%\.jdks\` |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk`: cmdline-tools 23.0, platform-tools 37.0.1 (adb 1.0.41), emulator 37.1.11, build-tools 36.0.0, platforms android-36 and android-37.0, NDK 27.1.12297006, CMake 3.22.1 |
| Gradle / AGP / Kotlin | 8.14.2 (wrapper) / 8.12.0 / 2.1.20 |
| AVD 1 (large phone) | `Pixel_9_Pro_XL`: 1344×2992 px at 480 dpi (**448×997 dp**), Android 17 (API **37**), image `google_apis_playstore_ps16k` x86_64, ABIs `x86_64,arm64-v8a`, **page size 16384**, launched with `-memory 4096`, front camera `-camera-front webcam1` (the host's **HP True Vision FHD Camera**; `webcam0` is a virtual camera). Debug build; this is the emulator with real hands |
| AVD 2 (small phone) | `Smoke_SmallPhone`: 720×1280 px at 320 dpi (**360×640 dp**), 1 GB RAM, same API 37.1 / `ps16k` x86_64 image, **no front camera** (`hw.camera.front=none`). Release build |
| AVD 3 (tablet) | `Smoke_Tablet`: 2560×1600 px at 320 dpi (**1280×800 dp**, 800×1280 dp when rotated), 2 GB RAM, same image, launched with airplane mode on and `-camera-front emulated` (the emulator's **synthetic scene, not the webcam**: no person is ever in these frames). Release build |
| Page size | `adb shell getconf PAGE_SIZE` printed **16384** on both running emulators |
| Physical devices | none (`adb devices` listed only emulators) |
| Not installed | API 36 system image (download declined) |

### Downloads performed (each approved in chat; user-writable locations)

| What | Source | Size | Integrity |
| --- | --- | --- | --- |
| Gradle 8.14.2 | services.gradle.org (wrapper) | ~130 MB | wrapper |
| Temurin JDK 21.0.12.1 | adoptium API / GitHub release | 195.6 MB | SHA-256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` matched |
| cmdline-tools 23.0 | dl.google.com | 147.8 MB | SHA-1 `57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d` matched |
| platform-36 r02, NDK r27b, CMake 3.22.1 | `sdkmanager` (dl.google.com) | 62.8 MB, 745.3 MB, 15.4 MB | sdkmanager |
| MediaPipe tasks-vision/core 1.0.0 and 0.10.35 (inspection), CameraX 1.6.2 | Google Maven | ~22 MB each | Gradle |
| `hand_landmarker.task` | storage.googleapis.com/mediapipe-models | 7,819,105 B | local MD5 = server `x-goog-hash` MD5; SHA-256 recorded |

`sdkmanager` (cmdline-tools 23) exits `-1073740791` after a *successful* install; the
packages were confirmed with `--list_installed`.

## 2. A01: baseline reproduction (commit `20ecffd`, clean tree)

| Command | Result |
| --- | --- |
| `npm ci` | exit 0, 900 packages, 20 s (npm reports the Skia `postinstall` "not covered by allowScripts"; the Skia Android libs are nevertheless present for all 4 ABIs and byte-identical to the sibling package) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | **exit 1**: 1 error (`'PhaseEntry' is defined but never used`), 13 warnings |
| `npm test -- --runInBand` | **exit 1**: `TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found` (no Jest mock) |
| `gradlew assembleDebug`, JDK 25 | **failed in 3.1 s**: `Unsupported class file major version 69` |
| `gradlew assembleDebug`, JDK 21 (default ABIs) | **BUILD SUCCESSFUL in 11m 55s**, 274 tasks; `android/app/build/outputs/apk/debug/app-debug.apk`, 220.9 MB (debug, 4 ABIs) |

Fixes made: removed the hard-coded `C:\Users\OBINexus\…` NDK path (two Gradle files);
deleted an unused interface (lint); added `jest.setup.js`, a local safe-area mock and a
Skia stub; the existing App test now uses fake timers and unmounts (it passed but its
`requestAnimationFrame` loop crashed the Jest process afterwards, exit 1). After the
fixes: lint 0 errors, Jest green.

## 3. A02: defects reproduced on `20ecffd` before any gameplay change

`__tests__/baseline/originalDefects.test.tsx` (since converted to regression tests; the
failing output is kept in `evidence/a02-original-defects-baseline.log`):

| Defect | Original result |
| --- | --- |
| swipe starting and ending inside a fruit | `Expected: true, Received: false` |
| a bomb that falls off-screen | lives `Expected: 3, Received: 2` |
| two bombs sliced in one frame | `onGameOver` `Expected number of calls: 1, Received: 2` |
| component re-creates its pool and RNG-seeded state on every render (found while reproducing) | `useRef(new FruitPool())` is evaluated each render |
| touches assigned by array index with `pageX/pageY` | confirmed by source (`GameScreen.tsx` lines 236–274); replaced by stable ids and canvas-local coordinates |

## 4. JavaScript test suite (final)

`npx tsc --noEmit`: exit 0. `npm run lint`: exit 0 (0 errors, 0 warnings; generated Gradle
output under `android/**/build` is excluded in `.eslintrc.js`). `npx jest --runInBand`:
**257 tests, 17 suites, all passing** (game engine, collision, trail, scoring, difficulty,
flow, touch, hand transform/tracker/adapter/calibration, permissions, setup screen,
session hook, adaptive layout, App). Camera and landmark inputs in these tests are
**fakes** and are labelled as such; they are not used for any acceptance claim below.

The new layout tests (`__tests__/ui/layout.test.tsx`) were mutation-checked: removing the
column style from the privacy screen, or making the HUD render while calibrating, makes
exactly those two tests fail; restoring the code makes all 10 pass.

Native JVM tests (`gradlew :react-native-hands:testDebugUnitTest`): see section 9.

## 5. Emulator: touch play (A02)

* Home screen renders; **Play with touch → boot (tap to skip) → game**; scripted swipes
  (`adb shell input swipe`): **score 10 after ~5 s, 3 lives intact**, sliced halves and
  a cyan blade trail on screen.
* Unplayed game on the original 3-life rules ended after ~4 s (first burst of up to
  three fruit missed): one motivation for the 15-life default.
* Pause button, background (`KEYCODE_HOME`) then return: `PAUSED` overlay with the score
  and lives preserved; **Resume** continues; idle until lives run out: `GAME OVER`,
  "You ran out of lives."; **Home** and **Privacy and licenses** work.
* Defect found and fixed here: system **Back** on Privacy exited the app (now handled by
  a `BackHandler` on every screen).
* Skia 2.6.2 logged deprecation warnings for `SkPath.moveTo/lineTo/close`; migrated to
  `Skia.PathBuilder`, warnings gone.
* Defect found and fixed: sprites load asynchronously in debug builds, so the game could
  run before fruit were visible; the frame loop now waits for sprites (5 s timeout).

## 6. Emulator: camera permission and lifecycle (A03)

Hand mode on the emulator with the app installed fresh (`pm revoke` first):

| Step | Observed |
| --- | --- |
| Choose hand mode, skip boot | Setup screen: "CAMERA ACCESS", explanation, **Allow camera**, **Play with touch instead**, **Back**. `granted=false`; no permission dialog on screen |
| Tap Allow camera | Real system dialog: "Allow FruitNinja to take pictures and record video?" with While using the app / Only this time / Don't allow |
| Don't allow | "CAMERA NOT ALLOWED": Try again + touch |
| Try again → Don't allow | "CAMERA IS OFF": **Open Settings** + touch; permission flags now `USER_FIXED` |
| Open Settings | `com.android.settings/.spa.SpaActivity` opens |
| Grant (via `pm grant`, standing in for the toggle) and press Back | app re-checked on foreground and went to **CALIBRATION** by itself |
| `dumpsys media.camera` in calibration | Active client: `com.fruitninja`, **camera 11 (front)** |
| Cancel (leave hand mode) | Active clients **`[]`** (camera released) |
| Re-enter, press HOME | Active clients **`[]`** (released on background) |
| Return | camera re-acquired, calibration shown again |
| Preview pixels (analysed locally, image not viewed) | middle band luminance mean **140.1**, stddev **27.2** over 6,750 samples (a blank view would be ~0/0) |

**No front camera** was exercised on the emulator (section 10): on the AVD configured
without a front camera, hand mode shows "NO FRONT CAMERA" with touch play as the primary
button.

**Not verified on a device or emulator:** one-time-permission expiry (state machine
unit-tested), the camera-disabled-by-policy and model-error screens (unit-tested; the AVDs
have a valid model and no policy).

## 7. Emulator: hand tracking with real hands (A04, A05)

Live camera → CameraX → MediaPipe Hand Landmarker (x86_64 `libmediapipe_tasks_jni.so`,
**CPU** delegate) → JS. The person in front of the webcam held up their hands.

**First live session** (development-build `[hands:stats]` log, final snapshot; session id 4
because the flow restarted the session for each game):

| Metric | Value |
| --- | --- |
| native frames received / submitted / dropped-busy | 1,559 / 960 / 599 (back-pressure `KEEP_ONLY_LATEST` + one frame in flight) |
| native results = samples emitted | 959 |
| native errors | **0** |
| native inference (submit → result) | avg **38.1 ms**, p95 **62 ms** (first 2 s of a session: avg 75.8 ms, p95 210 ms while warming up) |
| adapter accepted / dropped stale / out-of-order / obsolete-session / invalid | 957 / 2 (startup) / 0 / 0 / 0 |
| sample age at the adapter (analyzer arrival → JS apply) | avg **37.7 ms**, p95 **62.7 ms** |
| result rate | roughly 14 to 16 results/s on the emulator's CPU (target 20 to 30 is for hardware) |

Sample age is measured from the frame reaching the analyzer to the adapter applying it
in JS. It excludes sensor exposure/ISP time and display latency: **not** motion-to-photon
latency. These are emulator numbers, not a phone's.

**Observed behaviour:** hand count 1 then 2 in calibration (one hand `1 / 2`, both hands
`2 / 2`); lock, countdown, then play; score 7 within ~5 s of hand slicing, 12 with two
blades, 59 after 37 s in a later Casual round; repeated restarts through calibration.

**A real bug found only with the live camera.** The first screenshot showed the skeleton
overlay drawn stretched and rotated relative to the hands (an elongated orange skeleton
pointing down while the fingers pointed sideways). Inverting the drawn points gave a hand
~128×252 px in a 640×480 frame: its long axis ran along the frame's vertical axis. The
raw sample log then confirmed the geometry:

```
[hands:raw] {"raw":"640x480","rot":90,"lens":"front","hands":1,
  "wrist":[1.0106,0.4821],"index":[0.6183,0.2831],"middle":[0.5818,0.3881]}
```

Rotated 90° clockwise (raw (x,y) → upright (1−y, x)): wrist → (0.52, 1.01), the bottom
edge; index tip → (0.72, 0.62), **above** the wrist, matching a hand held with the fingers
up. So MediaPipe returns landmarks in the **raw** frame. Fix: native now reports the raw
size and `rotationDegrees`, and JS rotates exactly once (regression tests for rotation
90 and 270 in `handAdapter.test.ts`). **Status: numerically confirmed; the corrected
overlay has NOT been confirmed by a screenshot.** The first capture (before the fix)
produced the evidence above; later capture attempts failed for sequencing reasons on my
side (for example the app was on the game-over screen when the pose was held), and a final
event-driven watcher waited 20 minutes for a calibration lock and exited without seeing
one (`shot=False`). Whoever next plays in hand mode on a debug build should look at the
skeleton overlay once.

## 8. Privacy verification

| Claim | Evidence |
| --- | --- |
| Release requests no network permission | merged manifests below; release build guard |
| Debug vs release manifest | debug: `INTERNET, CAMERA, SYSTEM_ALERT_WINDOW, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION, ACCESS_NETWORK_STATE`. release: **`CAMERA, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`** only |
| Camera hardware features optional | `android.hardware.camera`, `.camera.any`, `.camera.front`, `.camera.autofocus` all `required=false` in the merged manifest |
| No storage/microphone/location permission | not present in the merged manifest |
| MediaPipe telemetry exists | decompiled `tasks-core-1.0.0`: `TasksStatsLoggerFactory.create` always returns `TasksStatsProtoLogger`; `RemoteLoggingClient` uses Google data-transport (`COREML_ON_DEVICE_SOLUTIONS`); logs package name/version and latency/error stats, no images or landmarks; no disable switch |
| It cannot transmit in release | no INTERNET permission (above); process group check: see section 10 |

## 9. Native artifacts and unit tests

| Check | Result |
| --- | --- |
| MediaPipe API (`javap`, 1.0.0 and 0.10.35) | identical: `createFromOptions`, `detectAsync(MPImage, ImageProcessingOptions, long)`, `RunningMode.LIVE_STREAM`, `Delegate.CPU/GPU`; `minSdk 24` |
| MediaPipe native libs | `libmediapipe_tasks_jni.so` for arm64-v8a, armeabi-v7a, x86, x86_64; all LOAD alignment 16384 |
| `check-elf-page-size.mjs` on the baseline debug APK | 60 libraries, **30 of 30 64-bit pass** (React Native, Hermes, Skia, Reanimated, worklets, gesture-handler, fbjni, c++_shared…) |
| Module build | `generateCodegenSchemaFromJavaScript`, `generateCodegenArtifactsFromSchema`, `verifyHandLandmarkerModel`, `compileDebugKotlin`: all succeeded on the first build (1m 4s, x86_64) |
| Kotlin JVM tests (`gradlew :react-native-hands:testDebugUnitTest`) | **24 tests, 0 failures, 0 errors, 0 skipped** (`InFlightTracker` 8, `LandmarkPacker` 7, `MonotonicTimestamps` 5, `RollingStats` 4); BUILD SUCCESSFUL in 30 s. They cover the pure-Kotlin core only (bounded in-flight work, monotonic timestamps, landmark packing, rolling stats). The CameraX and MediaPipe glue (`HandsController`, `HandDetector`) is exercised only on the emulator, not by JVM tests |

## 10. Release candidate (A08)

**This is a build and emulator result, not a Play-ready release.** The artifacts below are
signed with a throwaway key generated for the smoke test (`CN=Local smoke test only,
O=not for release`, valid 30 days, kept outside the repository and never committed). They
**cannot be uploaded to Play** and must not be. Only the owner's private upload key can
produce an uploadable AAB (RELEASE_CHECKLIST.md).

### Build

| Step | Result |
| --- | --- |
| `gradlew assembleRelease bundleRelease` with **no** signing properties | **fails at once**, no artifact: "Release signing is not configured, so no release artifact will be built (it is deliberately NOT signed with the debug key)…", naming only the four property names, never values |
| Same with a throwaway key in the environment (first time) | **BUILD SUCCESSFUL in 8m 43s** (383 tasks, 328 executed) |
| Incremental rebuilds after source changes | BUILD SUCCESSFUL in 26 to 28 s (the last one executed 50 of 383 tasks) |
| Build guards that ran | `:react-native-hands:verifyHandLandmarkerModel` (model SHA-256 gate) and `:app:verifyReleaseHasNoNetworkPermissions` |

### Artifacts (final build of this working session, made after the last source change)

Generated, git-ignored, and re-created on every build (each build re-signs, so hashes
change; a later source change needs a rebuild and new hashes):

| Artifact | Path | Size | SHA-256 |
| --- | --- | --- | --- |
| APK (universal: 3 ABIs, smoke tests only) | `android/app/build/outputs/apk/release/app-release.apk` | 129,610,397 B | `0ea2b5a568a795d659fce89187ad21d76eb2bd580366247a843ee7026e660425` |
| AAB (the format Play takes, but this one is signed with the throwaway key) | `android/app/build/outputs/bundle/release/app-release.aab` | 98,836,793 B | `f571ec5004ce12f1e9aab63d268f09bcf4a83b0f0eb6f100ed1d528f0ec948b8` |

Per-device download size after Play's ABI split is **unmeasured** (needs a Play upload or
`bundletool`).

### Static checks on the release artifacts

| Check | Result |
| --- | --- |
| `node scripts/check-elf-page-size.mjs` on the APK | **54 libraries, 36 64-bit (required), 0 failing**; every 64-bit `.so` has LOAD alignment 16384 and the APK zip alignment passes |
| same on the AAB | 54 libraries, 36 64-bit, **0 failing** (includes `libmediapipe_tasks_jni.so`, `librnskia.so`, `libreactnative.so`, `libreanimated.so`, `libworklets.so`, `libjsi.so`, `libnative-filters.so`, `libnative-imagetranscoder.so`) |
| `aapt2 dump badging` | package `com.fruitninja`, versionCode 1, versionName 1.0, minSdk 24, targetSdk 36, compileSdk 36; native code `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| permissions in the release APK | `android.permission.CAMERA` and the app-private `com.fruitninja.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (AndroidX). **No INTERNET, no ACCESS_NETWORK_STATE** |
| hardware features | `camera`, `camera.any`, `camera.autofocus`, `camera.front` and `screen.portrait` are all **not required** (`screen.portrait` was implied required by `screenOrientation="portrait"` until an explicit optional `uses-feature` was added) |
| `apksigner verify --print-certs` | verifies with the **v2** scheme, 1 signer, DN `CN=Local smoke test only, O=not for release` (v1 is not used at minSdk 24) |

### Release smoke test on emulators (Metro not running, airplane mode on)

| Check | Small phone (360×640 dp, no front camera) | Tablet (1280×800 dp, emulated front camera) |
| --- | --- | --- |
| Installs and cold-starts offline | yes, `am start -W` TotalTime **710 ms** | yes, **929 ms** on the first launch, **523 ms** on the reinstall |
| Home screen | renders; scrolls | renders in a 600 dp column (before the fix the buttons were ~1200 dp wide) |
| Touch play | yes (scripted swipes, fruit sliced) | yes (score 2 and 14 of 15 lives after 24 swipes; HUD and pause button in place) |
| Hand mode | "NO FRONT CAMERA" screen, touch play offered | explanation first (no dialog) → **Allow camera** → real system dialog → *While using the app* → calibration ("Raise both hands to begin"); `dumpsys media.camera` lists `com.fruitninja` holding the front camera |
| Rotate during calibration | not run | landscape → portrait → landscape: the same process keeps the camera; layout re-flows (buttons stay a 600 dp centred column); `logcat -b crash`, `AndroidRuntime:E` and `ReactNativeJS:E` empty afterwards |
| Leave hand mode (Cancel) | not applicable | Home shown; `dumpsys media.camera` lists **no** client (camera released) |
| Font scale 2.0 | not run | Home lays out top to bottom without overlap and scrolls; reset to 1.0 afterwards |
| Process network group | not run | `Groups: 9997 20231 50231`: **no 3003 (AID_INET)**; package flags `HAS_CODE ALLOW_CLEAR_USER_DATA` (not debuggable) |

For comparison the **debug** process on the large-phone AVD has `Groups: 3003 9997 20229 50229`
(it has INTERNET for Metro), so the missing 3003 in the release process is a real difference.
It supports the claim that MediaPipe's usage logger has no network path in a release build.

Target sizes measured from `uiautomator` bounds on the tablet: primary buttons are 56 dp
tall, the difficulty options 69 dp tall, the pause button 52 dp visible plus an 8 dp
`hitSlop` (all at or above 48 dp).

**Defects found by this smoke pass and fixed** (the three layout ones have regression tests
in `__tests__/ui/layout.test.tsx`): menus stretched edge to edge on a tablet; the HUD (score,
lives and an inert *Pause* button, since `PAUSE` is ignored while calibrating) showed
under the calibration overlay and overlapped its title; the calibration strips ignored
left/right safe-area insets; `screen.portrait` was implied required (fixed in the
manifest, verified with `aapt2`).

**Not done in the release smoke test:** upgrade over an older `versionCode` (each
throwaway key differs, so the previous install was removed first); pause / background /
game over on the *release* build (those were exercised on the debug build, section 5);
real hands with the release build (the tablet's synthetic scene contains no hands);
release on a physical device.

## 11. Known limits of this evidence

* **No physical Android device.** Frame times at 60 Hz, thermal, the ten-minute soak,
  memory over time, GPU delegate, front-camera geometry of a real phone and 16 KB behaviour
  on real hardware are unmeasured. The webcam is a laptop camera, whose frames are not a
  phone's, and every emulator number above (about 38 ms average sample age, roughly 15
  results/s) is an x86_64 CPU-delegate figure, not a phone's.
* The API 36 image was not used; results are API 37.1.
* The overlay alignment after the coordinate fix is **not visually confirmed** (section 7).
* Hand tracking with real hands was exercised on the **debug** build; the release build
  was exercised with a synthetic camera scene (no hands), so the release hand-tracking
  path is verified up to "camera bound, detector running, no crash", not "hands tracked".
* No screen-reader (TalkBack) traversal was run; accessibility labels, roles and live
  regions are asserted in unit tests and read from the `uiautomator` tree only.
* The release artifacts are signed with a throwaway key and are not uploadable; nothing
  was uploaded, and no Play review, policy or track requirement has been evaluated by Google.
