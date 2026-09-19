# Build, run and verify (Android)

Everything below was executed on the machine described in
[TEST_EVIDENCE.md](TEST_EVIDENCE.md). Paths shown as `%LOCALAPPDATA%` / `$HOME` are the
locations *discovered* there; substitute your own. No path in the repository points at
a developer's home directory.

## 1. Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 26.7.0 (engine requires `>=22.11.0`) | the old README said "Node 18+", which is wrong |
| JDK | **21** (Temurin 21.0.12.1) | Gradle 8.14.2 **cannot run on JDK 25**: `Unsupported class file major version 69`. JDK 17 to 24 work. |
| Android SDK | `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006`, `cmake;3.22.1`, `platform-tools`, `emulator` | `cmdline-tools` needed for `sdkmanager`/`avdmanager` |
| Gradle | 8.14.2 (wrapper) | downloaded by `gradlew` |

Install the SDK packages (quote each id: `;` is a delimiter in `cmd.exe`, which
`sdkmanager.bat` uses):

```powershell
# Windows PowerShell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jdk-21.0.12.1+1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$env:ANDROID_HOME" '"platforms;android-36"' '"ndk;27.1.12297006"' '"cmake;3.22.1"'
```

```sh
# POSIX
export JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1"
export ANDROID_HOME="$HOME/Android/Sdk"          # ~/Library/Android/sdk on macOS
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platforms;android-36" "ndk;27.1.12297006" "cmake;3.22.1"
```

`android/local.properties` is git-ignored; `ANDROID_HOME` is enough.

## 2. JavaScript checks

```sh
npm ci
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

Windows and POSIX are identical. Jest needs no emulator: the native module and Skia
are mocked in `__mocks__/`. Anything about the camera on a real device is verified on
a device, not in Jest.

## 3. Debug build and run on an emulator

```powershell
# Windows PowerShell   (from the repository root)
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
& "$sdk\emulator\emulator.exe" -list-avds
& "$sdk\emulator\emulator.exe" '@YOUR_AVD' -webcam-list          # note the webcam name
& "$sdk\emulator\emulator.exe" '@YOUR_AVD' -camera-front webcam1 -memory 4096
```

```sh
# POSIX
"$ANDROID_HOME/emulator/emulator" -list-avds
"$ANDROID_HOME/emulator/emulator" @YOUR_AVD -webcam-list
"$ANDROID_HOME/emulator/emulator" @YOUR_AVD -camera-front webcam0 -memory 4096
```

The emulator's default *emulated* front camera is a synthetic scene: it can never
show a hand. Use a host webcam (`-camera-front webcamN`) for hand tracking.

```powershell
adb devices                            # expect emulator-5554 device
cd android
.\gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64    # emulator ABI only: fast
cd ..
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:8081 tcp:8081
npm start                              # Metro, in a second terminal
adb shell am start -n com.fruitninja/.MainActivity
```

```sh
adb devices
(cd android && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
npm start
adb shell am start -n com.fruitninja/.MainActivity
```

`npm run android` does the build, install and launch in one step.

Dropping `-PreactNativeArchitectures=x86_64` builds the default ABIs
(`armeabi-v7a,arm64-v8a,x86_64`, see `android/gradle.properties`).

**If Metro stops serving bundles** (CPU pinned, the app sits on "Loading from
10.0.2.2:8081"), restart it with `npm start -- --reset-cache`. `metro.config.js`
blocks `android/**/build` and `.cxx`, whose churn during native builds was the
cause here.

## 4. Native unit tests (JVM)

```powershell
cd android
.\gradlew.bat :react-native-hands:testDebugUnitTest
```

Covers the bounded in-flight tracker, monotonic timestamps, landmark packing and
statistics used by the CameraX/MediaPipe session (`modules/react-native-hands`).

## 5. Release build

Release builds are signed with a **private upload key that is never in the repository**.
Without it the build fails on purpose (there is no fallback to debug signing):

```powershell
# Windows PowerShell: values from your password manager, not from a file in the repo
$env:FRUITNINJA_UPLOAD_STORE_FILE     = 'C:\secure\upload.jks'
$env:FRUITNINJA_UPLOAD_STORE_PASSWORD = '...'
$env:FRUITNINJA_UPLOAD_KEY_ALIAS      = '...'
$env:FRUITNINJA_UPLOAD_KEY_PASSWORD   = '...'
$env:FRUITNINJA_VERSION_CODE          = '2'          # must increase with every upload
cd android
.\gradlew.bat bundleRelease            # AAB for Play: app\build\outputs\bundle\release\app-release.aab
.\gradlew.bat assembleRelease          # APK for a local smoke test
```

```sh
export FRUITNINJA_UPLOAD_STORE_FILE=/secure/upload.jks
export FRUITNINJA_UPLOAD_STORE_PASSWORD=...
export FRUITNINJA_UPLOAD_KEY_ALIAS=...
export FRUITNINJA_UPLOAD_KEY_PASSWORD=...
export FRUITNINJA_VERSION_CODE=2
(cd android && ./gradlew bundleRelease assembleRelease)
```

The same names also work as Gradle properties in `~/.gradle/gradle.properties`.
`FRUITNINJA_APPLICATION_ID` and `FRUITNINJA_VERSION_NAME` are honoured too.

The build also **fails if the merged release manifest requests a network
permission** (`verifyReleaseHasNoNetworkPermissions`): the privacy design is "no
network access" (see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)).

### Checks on the artifacts

```sh
node scripts/check-elf-page-size.mjs android/app/build/outputs/apk/release/app-release.apk
node scripts/check-elf-page-size.mjs android/app/build/outputs/bundle/release/app-release.aab
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

```sh
# what the APK actually requests (permissions, optional features, ABIs, SDK levels)
"$ANDROID_HOME/build-tools/36.0.0/aapt2" dump badging android/app/build/outputs/apk/release/app-release.apk
```

Expect exactly `android.permission.CAMERA` (plus AndroidX's app-private
`…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`) and no `INTERNET`. On Windows use
`aapt2.exe` and `apksigner.bat`.

`check-elf-page-size.mjs` reads every `.so`'s ELF program headers (and the ZIP
alignment inside an APK) and fails if a 64-bit library is not 16 KB compatible.

### A local smoke build without your real key

To smoke-test a release build on an emulator before you have an upload key, create a
throwaway key **outside the repository**, and treat every artifact built with it as
unusable for Play:

```sh
keytool -genkeypair -alias smoketest -keyalg RSA -keysize 2048 -validity 30 \
  -keystore /tmp/LOCAL-SMOKE-TEST-ONLY.jks -dname "CN=Local smoke test only, O=not for release"
# then export the four FRUITNINJA_UPLOAD_* variables above, pointing at that file
```

The emulator install must be removed first when the key changes
(`adb uninstall com.fruitninja`), because Android refuses to update an app signed with a
different key.

## 6. 16 KB page-size test

`Pixel_9_Pro_XL` uses the `google_apis_playstore_ps16k` system image, so
`adb shell getconf PAGE_SIZE` prints `16384`. Installing and running the release APK
there is the runtime check for 16 KB devices.

## 7. Layout, rotation and font-scale checks (emulator)

Create AVDs of other sizes with `avdmanager` (or Device Manager) and check every screen
on at least one large one. The commands below need no extra tools:

```sh
adb -s emulator-5556 shell settings put system accelerometer_rotation 0
adb -s emulator-5556 shell settings put system user_rotation 1     # 0 natural, 1 = 90 degrees
adb -s emulator-5556 shell settings put system font_scale 2.0      # reset to 1.0 afterwards
adb -s emulator-5556 shell uiautomator dump /sdcard/ui.xml && adb -s emulator-5556 exec-out cat /sdcard/ui.xml
adb -s emulator-5556 shell dumpsys media.camera | grep "Client Package Name"   # who holds a camera
```

React Native `testID`s appear as `resource-id` in the dump, and every element's
`bounds` give its size in pixels (divide by density / 160 for dp). For a **release**
process, `adb shell "grep Groups /proc/$(adb shell pidof com.fruitninja | tr -d '')/status"`
must not list `3003` (Android's internet group); a debug build lists it.
