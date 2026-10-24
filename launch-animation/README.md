# Waka100 launch animation

React Native launch/loader animation for Waka100 in the style of Uber's
launch screen: a triangle, square and circle loader that ends by revealing the
"Waka100" wordmark from `waka100-logo-reference.png`.

## Install

Copy `src/` into your app and install the one dependency:

```sh
npx expo install react-native-svg   # or: npm i react-native-svg && cd ios && pod install
```

## Usage

```tsx
<LaunchAnimation
  ready={authChecked}                       // true once your app has finished starting up
  minCycles={2}                             // shortest loader run, in full 1.2s passes
  renderLogin={() => <LoginScreen />}       // your real login screen
  onDone={() => navigation.replace('Home')}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `ready` | — | The shape loader keeps looping until this is `true`. |
| `minCycles` | `2` | Full passes through triangle, square and circle (1.2s each) to play before the reveal, even if `ready` is already true. |
| `renderLogin` | — | Faded in underneath after the Waka100 reveal. It stays on screen afterwards. |
| `onDone` | — | Called once the hand-off has finished. |
| `fontSize` | 14% of screen width (max 64), plus 1 | Wordmark size in px; the shapes scale with it. Drawn in the system font at its heaviest weight (SF Pro Black on iOS, Roboto Black on Android). |
| `backgroundColor` | `#000000` | Screen colour. |

`WakaLogo` (the full icon redrawn in SVG) is also exported if you need the static logo anywhere else.

## Timeline

The motion copies Uber's Android launch animation: geometric shapes while loading, then the brand.

| Time | What happens |
| --- | --- |
| 0–0.5s | A merged shape (green triangle under a white square) tilts 40°, splits in two and swings back level. |
| then every 0.4s | Conveyor step (0.2s slide + 0.2s hold): the left shape shrinks and fades out against the left edge, the right one slides into its place, and the next grows in from the right edge. Order: triangle, square, circle, then repeat. |
| when ready | At the end of a pass (and not before `minCycles` passes), the two shapes swirl into the centre: they spiral inwards while spinning two full turns and shrinking away (0.65s). |
| +0.45s | The "Waka100" wordmark swirls out of the same point: it spins in from -300° while growing from 10% to full size with a slight overshoot (0.7s). White "Waka", green "100", with the icon's three green speed lines in front of the "W". |
| +0.9s hold | The screen fades out while `renderLogin()` fades in, then `onDone` fires. |

When the OS "Reduce Motion" setting is on, the shapes are skipped: the wordmark shows still and cross-fades out as soon as `ready` is true.

All animation runs on the native driver.
