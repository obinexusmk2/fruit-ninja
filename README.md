# Fruit Ninja: React Native, Skia and on-device hand tracking

An Android fruit-slicing game built with React Native (new architecture), Skia and a
native CameraX + MediaPipe hand-tracking module. Play with your **hands** (front
camera, processed on the phone) or with **touch**. The camera is optional.

> "Fruit Ninja" is a working title and a third-party trademark. It must be replaced
> with an original title before any store release. See
> [docs/android/RELEASE_CHECKLIST.md](docs/android/RELEASE_CHECKLIST.md).

## Documentation

| Doc | What it is |
| --- | --- |
| [docs/android/BUILD_AND_TEST.md](docs/android/BUILD_AND_TEST.md) | Exact build, emulator, test and release commands (Windows PowerShell and POSIX) |
| [docs/android/PLAN.md](docs/android/PLAN.md) | Architecture, decisions, tuning, requirements-to-files/tests matrix |
| [docs/android/TODO.md](docs/android/TODO.md) | Story board (Backlog to Done, plus Blocked with reasons) |
| [docs/android/TEST_EVIDENCE.md](docs/android/TEST_EVIDENCE.md) | Commands run and their real results, environment, measurements, limits |
| [docs/android/RELEASE_CHECKLIST.md](docs/android/RELEASE_CHECKLIST.md) | Google Play gates, blockers and the publisher's next actions |
| [docs/android/PRIVACY_POLICY.md](docs/android/PRIVACY_POLICY.md) | Draft privacy policy and Data safety notes |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Licenses of bundled components |

## How to play

* Slice fruit by swiping (touch) or by moving your index and middle fingers (hand
  mode). Each fruit is one point. A fruit that falls off-screen costs a life.
* **Bombs** end the game when sliced. Missing a bomb costs nothing.
* **Combo:** slice 3 or more fruit in one swipe and that swipe's score is doubled.
* **Critical hit:** a small random chance for +10 on any slice.
* **Game types** (Home screen): **Casual** (15 lives, gentle first 10 seconds with
  single fruit and no bombs; the default), **Challenge** (3 lives, the original rules)
  and **Practice** (no bombs). After a Casual game the Game Over screen offers the
  3-life challenge in one tap.
* **One-hand mode** (Home screen) uses one blade and one hand. Touch play never asks
  for the camera.

Hand mode: put the phone on a stable surface, choose *Play with hands*, read the
camera explanation and allow the permission, raise your hands until they lock, wait
for the countdown, then slice. If the camera cannot see your hands for 3 seconds the
game pauses; resuming asks you to raise your hands again.

## Quick start

Requirements: Node 22.11 or newer, **JDK 21** (JDK 25 does not work with Gradle 8.14),
Android SDK 36 with NDK 27.1.12297006 and CMake 3.22.1.

```sh
npm ci
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm start                # Metro (debug builds), then in another terminal:
npm run android
```

Full instructions, including the emulator with a host webcam and release builds, are in
[docs/android/BUILD_AND_TEST.md](docs/android/BUILD_AND_TEST.md).

## Project structure

```
src/
├── App.tsx                    # screen switcher driven by app/flow.ts
├── app/
│   ├── flow.ts                # pure reducer: home, boot, setup, calibrating, playing, paused, game over
│   ├── GameStage.tsx          # game world; owns the camera session in hand mode
│   └── branding.ts            # working title (replace before release)
├── game/                      # simulation, no React/Skia/camera imports
│   ├── simulation.ts          # fixed-step engine: scoring, lives, bombs, combos, crits
│   ├── collisionDetection.ts  # segment vs circle (inside, tangent, fast sweeps)
│   ├── trail.ts, config.ts, constants.ts, fruitSpawner.ts, objectPool.ts, rng.ts
│   └── GameScreen.tsx         # rendering, touch surface, frame loop
├── input/                     # blade input, shared by touch and camera
│   ├── bladeSet.ts            # the two blades; exactly one input mode owns them
│   ├── touchAdapter.ts        # stable pointer ids, canvas-local coordinates
│   ├── handAdapter.ts         # native samples to blades: validation, staleness, transforms
│   ├── handTracker.ts         # persistent hand identity (crossing, loss, re-acquisition)
│   ├── calibration.ts         # stable lock, countdown, cancel
│   └── transforms.ts, clockSync.ts
├── camera/                    # permission/setup UI, session hook, skeleton overlay
├── boot/, skia/, ui/, settings/, perf/
modules/react-native-hands/    # Android native module (Kotlin): TurboModule + Fabric preview view
├── src/specs/                 # typed contract (codegen)
└── android/                   # CameraX session, MediaPipe Hand Landmarker, bundled model + checksum
android/                       # Gradle app; release signing from the environment, never the repo
scripts/check-elf-page-size.mjs   # 16 KB page-size check for APK/AAB/AAR/.so
www/                          # the original browser prototype (separate; see below)
```

## Browser prototype (`www/`)

`www/index.html` is the original browser game (MediaPipe Hands from a CDN, webcam via
`getUserMedia`). It is **not** part of the Android app and needs internet access.
There is no `package.json` under `www/`; serve the repository root and open it:

```sh
npx serve          # then open http://localhost:3000/www/
```

`www/index_ringboot*.html` are separate boot-animation demos.

## Privacy in one paragraph

Hand mode analyses camera images on the phone with MediaPipe and never stores or
transmits them. The release app requests only the `CAMERA` permission (no internet),
which the build enforces. Details and evidence: `docs/android/PRIVACY_POLICY.md` and
`docs/android/TEST_EVIDENCE.md`.
