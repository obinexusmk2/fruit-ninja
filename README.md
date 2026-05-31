# Fruit Ninja — React Native TypeScript
```sh
$ curl -L https://github.com/obinexusmk2/fruit-ninja/archive/refs/heads/main.zip -o fruit-ninja.zip
$ unzip fruit-ninja.zip
$ cd fruit-ninja-main/www
```

```sh
$ wget -O fruit-ninja.zip \ https://github.com/obinexusmk2/fruit-ninja/archive/refs/heads/main.zip
```

A native Android Fruit Ninja game built with React Native, Skia, and a custom MMUKO boot sequence.

## Features

- **Two-hand input** — two simultaneous touch trails (cyan + orange) for slicing
- **MMUKO boot sequence** — animated 6-phase cyberpunk ring splash screen
- **Skia rendering** — 60fps fruit sprites, tapered blade trails, and splash effects via `@shopify/react-native-skia`
- **Object pooling** — 32-slot pool for zero-allocation gameplay
- **6 fruit types** — apple, banana, orange, coconut, pineapple, watermelon; each with whole + two half sprites
- **Bombs** — instant game over on contact
- **3 lives** — miss a fruit, lose a life

## Tech Stack

| Package | Version | Role |
|---|---|---|
| React Native | 0.85.2 | Framework |
| `@shopify/react-native-skia` | 2.6.2 | 2D canvas rendering |
| `react-native-reanimated` | 4.3.0 | Animation runtime |
| `react-native-worklets` | latest | Worklet runtime (Reanimated 4 dep) |
| `react-native-gesture-handler` | 2.31.1 | Touch input |
| TypeScript | strict | Type safety |

## Prerequisites

- **JDK 21** — Java 26 is incompatible with Android Gradle Plugin 8.x
  - Microsoft OpenJDK 21 ships with Android Studio: `C:\Program Files\Android\openjdk\jdk-21.0.8`
- **Android SDK** with platforms `android-36` and build-tools `36.0.0`
- **NDK 27.1.12297006** installed to a user-writable path (e.g. `C:\Users\<you>\Android\Sdk\ndk\27.1.12297006`)
- **CMake 3.22.1** installed to the same user-writable SDK root
- **Gradle 8.14.2** (set in `android/gradle/wrapper/gradle-wrapper.properties`)
- Node 18+ and npm

## Environment Setup

Set these before building:

```bash
export JAVA_HOME="/c/Program Files/Android/openjdk/jdk-21.0.8"
export ANDROID_HOME="/c/Program Files (x86)/Android/android-sdk"
```

`android/local.properties` must contain:

```
sdk.dir=C\:\\Program Files (x86)\\Android\\android-sdk
cmake.dir=C\:\\Users\\<you>\\Android\\Sdk\\cmake\\3.22.1
```

## Build

```bash
npm install

# Build debug APK
cd android
JAVA_HOME="/c/Program Files/Android/openjdk/jdk-21.0.8" \
ANDROID_HOME="/c/Program Files (x86)/Android/android-sdk" \
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Install & Run via ADB

```bash
# Verify device is connected (USB debugging must be enabled on device)
adb devices

# Install
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch
adb shell am start -n com.fruitninja/.MainActivity

# JS logs
adb logcat *:S ReactNativeJS:V
```

## Development

Start the Metro bundler in one terminal, then build/run in another:

```bash
npm start
```

```bash
npm run android
```

Hot reload is active during development — shake the device to open the dev menu.

## Project Structure

```
src/
├── App.tsx                   # Screen switcher: boot → game → gameover
├── boot/
│   ├── types.ts              # MMUKO phase enums and handoff interface
│   ├── mmukoBoot.ts          # Async 6-phase boot runner
│   └── BootScreen.tsx        # Skia ring + terminal HUD overlay
├── game/
│   ├── types.ts              # FruitEntity, BladeTrail, GameState
│   ├── constants.ts          # Physics and gameplay tuning values
│   ├── assets.ts             # Static sprite require() map
│   ├── objectPool.ts         # Fixed-size 32-slot fruit pool
│   ├── fruitSpawner.ts       # Parabolic arc spawn logic
│   ├── collisionDetection.ts # Line-segment vs circle (slice detection)
│   └── GameScreen.tsx        # Main game loop and canvas
├── skia/
│   ├── drawBootRing.ts       # 5 concentric cyan arcs + rotating nodes
│   ├── drawBackground.ts     # Full-screen background image
│   ├── drawFruit.ts          # Whole / half / explosion sprite drawing
│   ├── drawBlade.ts          # Tapered trail with glow
│   └── drawSplash.ts         # Fading splash effect at slice point
└── ui/
    ├── HUD.tsx               # Score and life icons overlay
    └── GameOver.tsx          # Final score and restart button
```

## MMUKO Boot Sequence

The app opens with a 6-phase animated boot screen:

| Phase | Label |
|---|---|
| 1 | NEED_STATE_INIT |
| 2 | SAFETY_SCAN |
| 3 | IDENTITY_CALIBRATION |
| 4 | GOVERNANCE_CHECK |
| 5 | INTERNAL_PROBE |
| 6 | INTEGRITY_VERIFICATION |

Each phase transitions `MAYBE → YES` over ~800ms. On completion the ring pulses green, `PASS (0xAA)` is displayed, and the game starts after ~5.3 seconds total.

## Troubleshooting

**`Unsupported class file major version 70`** — Java 26 is in use. Set `JAVA_HOME` to JDK 21.

**`IBM_SEMERU` build error** — Gradle 9.x removed this field. Ensure `gradle-wrapper.properties` uses `gradle-8.14.2-bin.zip`.

**`cmake;3.22.1 licence not accepted`** — Install CMake to a user-writable SDK root:
```bash
sdkmanager --sdk_root="C:\Users\<you>\Android\Sdk" "cmake;3.22.1"
```
Then add `cmake.dir` to `android/local.properties`.

**`build-tools;35.0.0 licence not accepted`** — The root `build.gradle` forces all subprojects to use build-tools 36.0.0. No action needed.
