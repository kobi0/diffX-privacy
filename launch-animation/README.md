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
  onDone={() => navigation.replace('Home')}
/>
```

| Prop | Default | |
| --- | --- | --- |
| `ready` | — | The shape loader keeps looping until this is `true`. |
| `minCycles` | `2` | Full passes through triangle, square and circle (1.2s each) to play before the reveal, even if `ready` is already true. |
| `renderLogin` | — | Optional. Leave it out and the animation ends on Waka100. Pass it to cross-fade from Waka100 into that screen. |
| `onDone` | — | Called when the animation has finished (after the Waka100 hold, or after the cross-fade). |
| `fontSize` | 15% of screen width (max 72), plus 1 | Wordmark size in px. Drawn in the system font at its heaviest weight (SF Pro Black on iOS, Roboto Black on Android). |
| `backgroundColor` | `#000000` | Screen colour. |

`Wordmark` (the 3D wordmark on its own) and `WakaLogo` (the full icon redrawn in SVG) are also exported if you need the static logo anywhere else.

## Timeline

The motion copies Uber's Android launch animation: geometric shapes while loading, then the brand.

| Time | What happens |
| --- | --- |
| 0–0.5s | A merged shape (green triangle under a white square) tilts 40°, splits in two and swings back level. |
| then every 0.4s | Conveyor step (0.2s slide + 0.2s hold): the left shape shrinks and fades out against the left edge, the right one slides into its place, and the next grows in from the right edge. Order: triangle, square, circle, then repeat. |
| when ready | At the end of a pass (and not before `minCycles` passes), the two shapes swing back together and tilt (0.2s), then hard-cut to the 3D "Waka100" wordmark: silver "Waka", green "100", with the icon's three green speed lines in front of the "W". |
| +0.15s | A soft reflection sweeps diagonally across the wordmark (0.75s). |
| +1.3s | `onDone` fires. The animation ends on the wordmark, which stays on screen. If you pass `renderLogin`, the wordmark cross-fades into that screen first. |

When the OS "Reduce Motion" setting is on, the shapes are skipped: the wordmark shows still and finishes as soon as `ready` is true.

## The 3D wordmark

`src/Wordmark.tsx` builds the wordmark from stacked copies of the text, so it needs no image assets or extra packages:

- **Glow:** a soft green halo behind the letters.
- **Depth:** seven darker copies stepped down and to the right, giving the letters and speed lines a solid extruded edge.
- **Face:** the letters, light grey for "Waka" and green for "100".
- **Lit top:** the upper half of each letter in a brighter shade, like light from above.
- **Shine:** a soft diagonal reflection that sweeps across once after the reveal.

All animation runs on the native driver.
