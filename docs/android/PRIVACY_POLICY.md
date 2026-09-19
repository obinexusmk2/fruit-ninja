# Privacy policy (draft for publication)

> **DRAFT, not yet published.** Play requires a public URL for this policy and a link
> to it inside the app. The publisher must (1) confirm the contact address, (2) host
> the final text at a stable public URL, and (3) re-verify every statement against the
> release build (checklist in `RELEASE_CHECKLIST.md`). Statements below are written to
> match how the app actually behaves; the evidence for each is listed after the policy.

**App:** `<PUBLIC TITLE, to be chosen>` ("the game")
**Publisher:** `<publisher legal name>` · **Contact:** `<support email, owner to confirm>`
**Effective date:** `<date of first release>`

## What the game does with your camera

The game has an optional **hand mode**. When you choose it and allow camera access,
the game uses the **front camera** while you are calibrating or playing to find your
hands, so your hand movements can slice the fruit.

* The pictures from the camera are **processed on your phone only**.
* They are **not saved, not recorded, and not sent anywhere**. The game keeps only the
  position of your fingertips for a fraction of a second.
* The camera is turned off when you leave hand mode, pause, or switch away from the
  game.
* You can play without the camera at any time: **touch mode never asks for camera
  access**.

You can withdraw camera access at any time in **Android Settings > Apps > (the game) >
Permissions > Camera**. The game then offers touch play instead.

## What we collect

**Nothing.** The game has no accounts, no advertising, no analytics and no crash
reporting service of its own, and it does not need an internet connection: it does not
ask Android for network permission, so it cannot send information off your phone.

It does not ask for your location, contacts, microphone, storage, or any other
permission besides the camera (and only in hand mode).

Game settings (such as one-hand mode) are not stored between sessions.

## Third-party software inside the game

The game contains Google's MediaPipe Hand Landmarker and AndroidX CameraX, which run
locally on your phone. MediaPipe includes usage-statistics code that, in an app *with*
network permission, would send technical diagnostics to Google. This game does not
request network permission, so that code has no way to send anything. If a future
version adds network access, this policy and the Play Data safety form will be
updated before release.

## Children

`<Owner decision: target audience. If the game is directed at children, additional
Play Families and COPPA requirements apply. See RELEASE_CHECKLIST.md.>`

## Changes and contact

We will publish changes to this policy at this address before they apply.
Questions: `<support email>`.

---

## Evidence for each statement (remove before publishing)

| Statement | Evidence | Where recorded |
| --- | --- | --- |
| Camera frames are processed on-device, not saved or sent | No JS camera access; frames are copied into a reused in-memory `Bitmap` and passed to MediaPipe; no file, socket or network code in `modules/react-native-hands`; release build has no INTERNET permission | `TEST_EVIDENCE.md` "Privacy verification" |
| No network permission | Merged **release** manifest requests only `CAMERA`; build fails otherwise (`verifyReleaseHasNoNetworkPermissions`) | `TEST_EVIDENCE.md`; `android/app/build.gradle` |
| The app cannot open sockets | Running release process is not in group `inet` (3003) | `TEST_EVIDENCE.md` |
| Camera released when leaving hand mode / backgrounding | `dumpsys media.camera` shows no active client | `TEST_EVIDENCE.md` |
| Touch mode never asks for the camera | Touch flow never reaches the setup screen or requests permission (unit + emulator) | `TEST_EVIDENCE.md` |
| No storage/microphone/location permission | Merged manifest | `TEST_EVIDENCE.md` |
| Settings are not persisted | No storage dependency (`src/settings/useSettings.ts` is in-memory) | source |
