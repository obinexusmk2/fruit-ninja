# Third-party notices

This file lists the components that ship inside the Android app and their licenses.
Versions are the ones pinned in this repository. **It is a working inventory, not legal
advice; the release owner must re-verify it before publishing** (see
`docs/android/RELEASE_CHECKLIST.md`, "Licenses and assets").

## Hand tracking

| Component | Version | License | Source |
| --- | --- | --- | --- |
| MediaPipe Tasks Vision (`com.google.mediapipe:tasks-vision`, `tasks-core`) | 1.0.0 | Apache License 2.0 | https://github.com/google-ai-edge/mediapipe |
| MediaPipe Hand Landmarker model bundle `hand_landmarker.task` (float16, v1) | file dated 2023-04-26 | Apache License 2.0 per the MediaPipe repository and model cards; **to be re-confirmed by the owner** | `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` |
| AndroidX CameraX (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`) | 1.6.2 | Apache License 2.0 | https://developer.android.com/jetpack/androidx/releases/camera |

**Model file:** 7,819,105 bytes, SHA-256
`fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, recorded in
`modules/react-native-hands/android/src/main/assets/hand_landmarker.task.sha256`. The
download was checked against the server-side MD5 published by Google Cloud Storage
(`FTGEMOo4UWcP6ZFBFqnPrQ==`). The build fails if the file does not match its recorded
SHA-256, and the app re-checks it when the camera starts.

The bundle contains two TensorFlow Lite models: `hand_detector.tflite` (palm detector)
and `hand_landmarks_detector.tflite`.

MediaPipe Tasks transitively includes Google's data-transport libraries
(`com.google.android.datatransport:*`), Guava, Flogger and protobuf-lite. See
"Data collection by dependencies" in `docs/android/RELEASE_CHECKLIST.md`: the app
requests no network permission, which prevents that code from transmitting anything.

## App framework and rendering

| Component | Version | License |
| --- | --- | --- |
| React Native | 0.85.2 | MIT |
| React | 19.2.3 | MIT |
| @shopify/react-native-skia (and its prebuilt Skia libraries) | 2.6.2 | MIT (Skia: BSD-3-Clause) |
| react-native-reanimated | 4.3.x | MIT |
| react-native-worklets | 0.8.x | MIT |
| react-native-gesture-handler | 2.31.x | MIT |
| react-native-safe-area-context | 5.x | MIT |
| Hermes JavaScript engine | bundled with React Native | MIT |

Run `npx license-checker --production --summary` (or an equivalent) against the
lockfile before release to catch transitive dependencies; that has **not** been done
in this repository yet.

## Project assets that need clearance before a commercial release

These are *not* third-party licenses; they are open questions the owner must close.
See `docs/android/RELEASE_CHECKLIST.md`.

* The name "Fruit Ninja" is a trademark of Halfbrick Studios. A working title only.
* `assets/` and `www/assets/` (fruit, bomb, splash and background images), the
  launcher icons and `docs/How to play Fruit Ninja.pdf`: their origin and license are
  not recorded in this repository.
* The gameplay ideas in this game (slicing, lives, bombs, combos, critical hits) are
  general mechanics; all UI text, names and visuals for them in this project are
  original and must stay that way.
