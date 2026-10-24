# Waka100 launch animation

React Native launch/loader animation for Waka100 in the style of Uber's
launch screen. The characters of the "Waka100" wordmark (from
`waka100-logo-reference.png`) take the place of Uber's circle and square.

## Install

Copy `src/` into your app and install the one dependency:

```sh
npx expo install react-native-svg   # or: npm i react-native-svg && cd ios && pod install
```

## Usage

```tsx
<LaunchAnimation
  ready={authChecked}                       // true once your app has finished starting up
  minCycles={1}                             // shortest loader run, in full 2.8s passes
  renderLogin={() => <LoginScreen />}       // your real login screen
  onDone={() => navigation.replace('Home')}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `ready` | — | The loader keeps looping until this is `true`. |
| `minCycles` | `1` | Full passes through W·a·k·a·1·0·0 (2.8s each) to play before handing off, even if `ready` is already true. |
| `renderLogin` | — | Faded in underneath during the hand-off. It stays on screen afterwards. |
| `onDone` | — | Called once the hand-off has finished. |
| `fontSize` | 14% of screen width (max 64), plus 1 | Character size in px. Drawn in the system font at its heaviest weight (SF Pro Black on iOS, Roboto Black on Android). |
| `backgroundColor` | `#000000` | Screen colour. |

`WakaLogo` (the full icon redrawn in SVG) is also exported if you need the static logo anywhere else.

## Timeline

The motion copies Uber's Android launch animation, using the Waka100 letters and numbers in place of Uber's circle and square.

| Time | What happens |
| --- | --- |
| 0–0.9s | The "Waka100" wordmark holds (white "Waka", green "100"), with the icon's three green speed lines in front of the "W". The "W" keeps its speed lines through the whole animation. |
| 0.9s | Hard cut: the wordmark collapses into one merged glyph, "W" stacked on "a". |
| 0.95–1.3s | The glyph tilts 40°, splits into "W" and "a", and swings back level. |
| then every 0.4s | Conveyor step (0.2s slide + 0.2s hold): the left character shrinks and fades out against the left edge, the right one slides into its place, and the next grows in from the right edge. Order: W a k a 1 0 0, then repeat. |

Once `ready` is true, the loader hands off at the end of the next full pass (and not before `minCycles` passes). The loader fades out while `renderLogin()` fades in, then `onDone` fires. When the OS "Reduce Motion" setting is on, the wordmark stays still and cross-fades out as soon as `ready` is true.

All animation runs on the native driver.
