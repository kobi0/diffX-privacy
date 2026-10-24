# Waka100 launch animation

React Native launch/loader animation built from the Waka100 app icon
(`waka100-logo-reference.png`). The logo is redrawn in vector (`src/WakaLogo.tsx`)
on the icon's 512×512 grid, so the finished frame matches the icon.

## Install

Copy `src/` into your app and install the one dependency:

```sh
npx expo install react-native-svg   # or: npm i react-native-svg && cd ios && pod install
```

## Usage

```tsx
<LaunchAnimation
  ready={authChecked}                       // true once your app has finished starting up
  minCycles={2}                             // shortest loader run, in full 1.8s cycles
  renderLogin={() => <LoginScreen />}       // your real login screen
  onDone={() => navigation.replace('Home')}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `ready` | — | The loader keeps looping until this is `true`. |
| `minCycles` | `2` | Full 1.8s cycles to play before the outro, even if `ready` is already true. |
| `renderLogin` | — | Rendered underneath and faded in during the hand-off. It stays on screen afterwards. |
| `onDone` | — | Called once the hand-off has finished. |
| `showTile` | `true` | Draw the rounded app-icon tile behind the mark. |
| `size` | 72% of shorter side (max 380) | Logo edge length in px. |
| `backgroundColor` | `#050607` | Screen colour behind the logo. |

`WakaLogo` is also exported if you need the static logo anywhere else.

## Timeline (one 1.8s cycle)

| Time | What happens |
| --- | --- |
| 0.00–0.40s | First `\` of the W slides down into place |
| 0.18–0.58s | The `/` that runs behind the W slides in |
| 0.36–0.76s | The front `\` lands over it |
| 0.54–1.01s | Speed lines streak in from the left |
| 0.68–1.30s | The two "0" rings pop in with an overshoot, left then right |
| 0.90s | The "Waka100" wordmark rises in (first cycle only, then stays) |
| 1.30–1.55s | Hold on the full logo |
| 1.55–1.80s | The mark dashes off to the right while the speed lines trail, then the loop restarts |

When `ready` is true and `minCycles` cycles have played, the logo assembles one
last time, holds, then scales up and fades out while `renderLogin()` fades in.
Then `onDone` fires. When the OS "Reduce Motion" setting is on, the loop is
skipped: the full logo is shown and cross-fades out as soon as `ready` is true.

All animation runs on the native driver.
