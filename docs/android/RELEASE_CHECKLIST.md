# Google Play release checklist

**Scope:** this prepares a reviewable release candidate. **Nothing has been uploaded or
published, and no Play approval is claimed or implied.** Source review, a successful
build, emulator verification, physical-device verification and Play approval are five
different things; none implies another. Measured results are in
[TEST_EVIDENCE.md](TEST_EVIDENCE.md).

Checked on 19 September 2026. Play policy changes; re-check every linked policy at
submission time.

## 0. Release blockers (owner actions)

| # | Blocker | Why it blocks | Who |
| --- | --- | --- | --- |
| 1 | Choose an **original public title** and a **publisher-owned application ID** | "Fruit Ninja" is Halfbrick Studios' trademark; the app ID `com.fruitninja` cannot be changed after the first upload | owner |
| 2 | **License audit and replacement of `assets/`, `www/assets/`, icons, `docs/*.pdf`** | provenance is not recorded; Play IP policy | owner (task B06) |
| 3 | Create the **upload key**; enable **Play App Signing** | only the owner may hold it; builds fail without it (by design) | owner |
| 4 | Host the **privacy policy** at a public URL and link it in the app and listing | Play User Data policy | owner (draft: PRIVACY_POLICY.md) |
| 5 | Confirm **target audience / content rating / ads declaration** | required forms | owner |
| 6 | **Physical-device verification** (arm64 phone, ideally also a 16 KB device) | none has been done; emulator only | owner or a tester |
| 7 | Store assets: icon, feature graphic, screenshots of the **real build**, support contact | listing | owner (task B07) |
| 8 | Closed-test requirement if the developer account is a **personal account created after 13 Nov 2023**: 12+ testers opted in for 14 continuous days before production access | policy; emulator runs never count | owner |

## 1. Target API and platform behaviour

* `targetSdk 36`, `compileSdk 36`, `minSdk 24` (`android/build.gradle`). The brief states
  target API 36 or higher is required for new phone apps as of 19 Sep 2026; re-check
  <https://support.google.com/googleplay/android-developer/answer/11926878> when you
  submit. `targetSdk` alone is not readiness:
* **Edge-to-edge is enforced** at this target (the app draws under the system bars; the
  UI uses safe-area insets, and `edgeToEdgeEnabled=false` in `gradle.properties` no
  longer has effect on Android 15+). Verified on the API 37.1 emulator.
* **Large screens (≥ 600 dp):** from API 36 the OS ignores `screenOrientation="portrait"`
  and resizability restrictions there, and `android.hardware.screen.portrait` is declared
  optional so Play does not filter out landscape-only devices. The layout uses measured
  sizes, insets, scrolling menus and a 600 dp readable column. It was exercised on a
  1280×800 dp tablet emulator in landscape and portrait (rotation during calibration kept
  the camera and the layout), on 360×640 dp and 448×997 dp phone emulators. Not done: a
  physical tablet or foldable, split-screen/multi-window, and a TalkBack pass.
* Runtime permission behaviour (deny, "don't ask again", Settings return) was exercised
  on the emulator. One-time permission expiry is covered by unit tests of the state
  machine only.
* The API 36 system image was not installed (declined download); testing used API 37.1.
  Re-test on an API 36 device or image before release.

## 2. Signing, versioning, artifacts

1. Generate the upload key with `keytool` (RSA 2048+), store it **outside the repo**,
   back it up, and enrol in **Play App Signing** (Google holds the app signing key).
2. Provide it to Gradle only through the environment or `~/.gradle/gradle.properties`:
   `FRUITNINJA_UPLOAD_STORE_FILE`, `..._STORE_PASSWORD`, `..._KEY_ALIAS`,
   `..._KEY_PASSWORD`. Passwords are never printed. Without them `bundleRelease` and
   `assembleRelease` **fail at once** (verified: 6 s, no artifact) and are never signed
   with the debug key.
3. Increase `FRUITNINJA_VERSION_CODE` for **every** upload (integers only go up); set
   `FRUITNINJA_VERSION_NAME` and, before the first upload, `FRUITNINJA_APPLICATION_ID`.
4. Build: `./gradlew bundleRelease` (upload the **AAB**) and `assembleRelease` (local
   smoke test). Record the AAB path and SHA-256 in the release notes.
5. `minifyEnabled` is **false** (`enableProguardInReleaseBuilds`). Enabling R8 needs
   keep-rule testing with MediaPipe/React Native; decide with the owner.

Release smoke test (each step on the **release** APK, Metro not running). The boxes are
for the **physical-device** run, which has not been done. What was done on emulators is
listed under the list and is not a substitute:

- [ ] installs over an older `versionCode` (upgrade) and fresh (reinstall);
- [ ] cold start with **airplane mode on** reaches the home screen;
- [ ] touch game: play, pause, background/foreground, game over, restart;
- [ ] hand mode: explanation → permission → calibration → countdown → play → leave; camera
      released (`adb shell dumpsys media.camera`);
- [ ] deny, deny-again (Settings), grant via Settings, revoke;
- [ ] `adb shell getconf PAGE_SIZE` on a 16 KB device or emulator prints `16384` and the
      app runs.

Done so far on emulators only (TEST_EVIDENCE.md section 10; API 37.1, 16 KB pages, release
APK signed with a throwaway key, Metro not running, airplane mode on): fresh install;
cold start to Home offline (710 ms small phone, 523 to 929 ms tablet); touch play;
hand-mode explanation → Allow → system dialog → calibration with the front camera held by
the app; rotation during calibration; Cancel releases the camera (`dumpsys media.camera`
lists no client); "NO FRONT CAMERA" screen on an AVD without one; `getconf PAGE_SIZE`
= 16384. **Not done:** upgrade over an older versionCode (each throwaway key differs);
pause / background / game over and deny / deny-again / Settings on the *release* build
(done on the debug build); real hands on the release build; any physical device.

## 3. 64-bit support and 16 KB page size

* ABIs shipped: `arm64-v8a` (required), `armeabi-v7a`, `x86_64`.
* `node scripts/check-elf-page-size.mjs <apk|aab>` reads every `.so`'s program headers
  and ZIP alignment and fails on any 64-bit library that is not 16 KB compatible. It
  passed on the debug APK (30 of 30 64-bit libraries), on the MediaPipe AARs and on the
  **release APK and AAB** (54 libraries, 36 of them 64-bit, 0 failing; TEST_EVIDENCE
  section 10). **Do not assume a configured NDK makes
  prebuilt libraries compliant:** this script is the check. Re-run it after every
  dependency upgrade.
* A 16 KB environment exists here (`Pixel_9_Pro_XL`, `ps16k` image); use it for the
  runtime check above. Reference: <https://developer.android.com/guide/practices/page-sizes>.

## 4. Original title, application ID, intellectual property

**Proposed (owner to confirm; nothing else in the code depends on them):**

| Item | Proposal | Notes |
| --- | --- | --- |
| Title | "Slicewave", "Handcut Dojo" or "MMUKO Slice" (pick one and search the Play Store and trademark registers first) | avoid "Ninja"/"Fruit" combined with well-known marks |
| Application ID | `com.<owner-controlled-domain>.<shortname>`, e.g. `org.obinexus.slicewave` | the domain must be one the publisher owns; cannot change after first upload; set `FRUITNINJA_APPLICATION_ID` |
| Kotlin namespace | keep `com.fruitninja` internally | independent of the applicationId |

* Replace `src/app/branding.ts` (`APP_TITLE`), `android/app/src/main/res/values/strings.xml`
  (`app_name`), the launcher icons and the README title.
* **Assets to audit/replace before commercial release:** everything under `assets/` and
  `www/assets/` (fruit, bomb, splash, background, `assets.zip`), the mipmap launcher
  icons, `docs/How to play Fruit Ninja.pdf`, any fonts and sounds. Their origin is not
  recorded in this repository. If any came from the commercial game or a stock source
  with restrictive terms, replace them. Policy:
  <https://support.google.com/googleplay/android-developer/answer/9888072>.
* **Mechanics vs. expression.** The slicing, lives, bombs, combo and critical-hit rules
  follow a publicly described game style (owner request, referencing Halfbrick's beginner's
  guide). Rules are generally not protected, but names, art, sounds and UI text are. This
  project uses **original names** ("Casual/Challenge/Practice", "combo", "critical") and
  draws no copied artwork. Keep it that way (for example, do not add banana power-ups
  styled like the original, or the original feature names).
* Repository history is retained (this work is a branch of the existing history).
* Code and model licenses are inventoried in `THIRD_PARTY_NOTICES.md`; the hand model's
  license should be re-confirmed by the owner from Google's model card.

## 5. Privacy policy and Data safety

Draft policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md). Must be public, linked in the
listing and reachable in the app (the app has a *Privacy and licenses* screen).

### Data collection by dependencies (verified, not assumed)

MediaPipe Tasks 1.0.0 (`tasks-core`) contains a **remote usage-statistics logger**:
`TasksStatsLoggerFactory.create` always returns `TasksStatsProtoLogger`, which builds
`SolutionEvent` records (task name and mode, init latency, invocation counts, latency
statistics, errors, plus `SystemInfo` with the **app package name and version**) and sends
them through `RemoteLoggingClient` (Google data-transport, log source
`COREML_ON_DEVICE_SOLUTIONS`). It never includes images or landmarks, and its Java API
has **no switch to disable it**. (Found by decompiling the pinned AAR; recorded in
TEST_EVIDENCE.)

**Mitigation:** the release build requests **no `INTERNET` permission**. Android then
denies the app every network socket, so this code cannot transmit. Enforced three ways:
`src/release/AndroidManifest.xml` removes `INTERNET`/`ACCESS_NETWORK_STATE` (the latter is
added by data-transport); the build task `verifyReleaseHasNoNetworkPermissions` fails the
release build if the merged manifest contains a network permission; and the running
release process was checked to not be in the `inet` group (TEST_EVIDENCE).

**Consequences for the owner:** if you ever add network access (ads, analytics, accounts,
crash reporting), MediaPipe's telemetry becomes active: update the Data safety form
(diagnostics: app info and performance) and the policy **before** releasing. Confirm with
Google's current Data safety guidance how a *blocked* SDK should be declared; the draft
assumes "no data collected".

### Data safety draft (answers for the current build)

| Question | Draft answer | Basis |
| --- | --- | --- |
| Does the app collect or share any user data? | **No** | no network permission; nothing stored; settings in memory |
| Camera (photos and videos)? | Not collected: frames are processed on-device in memory and never stored or transmitted | code + no network |
| Is data encrypted in transit? | Not applicable (no data leaves the device) | |
| Can users request deletion? | Not applicable | |
| Permissions requested | `CAMERA` only, optional feature, requested in context after an explanation | merged release manifest |

## 6. Store declarations (owner decisions)

* **Category:** Games (arcade/casual). **Ads:** none. **In-app purchases:** none.
* **Content rating (IARC):** answer for cartoon-style fruit slicing and cartoon bombs; the
  rating must come from the completed questionnaire, not from this document.
* **Target audience:** decide. If children under 13 are a target audience, Play Families
  Policy and COPPA apply (no analytics/ads/accounts already helps; the camera feature and
  the privacy text need a child-appropriate review). The draft assumes a general audience.
* **Support contact:** owner to supply.
* **Screenshots:** capture from the real build: home (with game types), hand-mode
  calibration, gameplay with combo banner, game over, camera-permission explanation.
  (No screenshots of a person's webcam image should be published without their consent.)

## 7. Testing tracks

Use **internal testing** first. For personal developer accounts created after
13 November 2023 Play requires at least **12 testers continuously opted in to a closed
test for 14 days** before you can apply for production access
(<https://support.google.com/googleplay/android-developer/answer/14151465>). Determine
whether your account is affected. Emulator and single-developer runs do not satisfy it.

## 8. Next concrete action for the publisher

1. Decide the title and application ID (section 4) and create the upload key (section 2).
2. Run `bundleRelease` with the key in your environment and record the AAB SHA-256.
3. Install the release APK on a physical arm64 phone and complete the smoke test list.
4. Publish the privacy policy, complete the Data safety, rating and audience forms.
5. Upload to internal testing.
