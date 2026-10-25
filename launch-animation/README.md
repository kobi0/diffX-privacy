# Waka100 launch animation

React Native launch/loader animation for Waka100 in the style of Uber's
launch screen: a triangle, square and circle loader that ends by revealing the
"Waka100" wordmark from `waka100-logo-reference.png`.

## Install

Copy `src/` (including `src/fonts/`) into your app and install its dependencies:

```sh
npx expo install react-native-svg expo-haptics expo-font
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
| `fontSize` | 12.5% of screen width (max 60), plus 1 | Wordmark size in px. |
| `tagline` | `"YOUR RIDE, YOUR RULES!"` | The line the dots turn into. |
| `backgroundColor` | `#000000` | Screen colour. |
| `haptics` | `true` | Vibrate briefly (a medium tap) when the wordmark appears. |

`Wordmark` (the 3D wordmark on its own) and `WakaLogo` (the full icon redrawn in SVG) are also exported if you need the static logo anywhere else.

## Timeline

The motion copies Uber's Android launch animation: geometric shapes while loading, then the brand.

| Time | What happens |
| --- | --- |
| 0–0.5s | A merged shape (green triangle under a white square) tilts 40°, splits in two and swings back level. |
| then every 0.4s | Conveyor step (0.2s slide + 0.2s hold): the left shape shrinks and fades out against the left edge, the right one slides into its place, and the next grows in from the right edge. Order: triangle, square, circle, then repeat. |
| when ready | At the end of a pass (and not before `minCycles` passes), the two shapes swing back together and tilt (0.2s), then cut to the 3D "Waka100" wordmark, with a short medium-strength vibration. |
| 0–0.45s | **Rise:** each letter is uncovered from the bottom up by a rising mask, one after another from left to right. The green speed lines come in with the "W". |
| +0.25s | Hold. |
| 1.8s | **Width wave:** the whole word grows 60% taller from its baseline while a swell rolls through the letters from left to right, one and a half times. Letters trade width with each other (from about 55% to 145% of their own width) so the word's overall width never changes. The wave fades out and the letters settle back to even widths. |
| +0.15s | A soft reflection glides across the wordmark (1.1s). |
| +0.35s | **Collapse:** left to right, each letter shrinks into a dot of its own colour (0.6s). |
| 0.45s | The dots glide into an evenly spaced row as wide as the tagline. |
| 0.7s | **Tagline:** "YOUR RIDE, YOUR RULES!" rises out of the dots word by word, from the bottom up, as the dots shrink away. |
| +0.9s | `onDone` fires. The animation ends on the tagline, which stays on screen. If you pass `renderLogin`, it cross-fades into that screen first. |

The rise and width wave copy the kinetic-type reveal of a "CLAUDE" title card, measured frame by frame: a fast bottom-up mask reveal staggered across the letters, then a travelling width wave at a fixed word width while the word grows taller. The card's last beat is used too: the letters collapse into dots, which become the tagline.

When the OS "Reduce Motion" setting is on, the shapes are skipped: the wordmark shows still and finishes as soon as `ready` is true.

## Fonts

"WAKA100" is set in **Orbitron Black** and the tagline in **Orbitron Medium**. Both files are in `src/fonts/` under the SIL Open Font License (`src/fonts/OFL.txt`), which allows bundling them in an app. `LaunchAnimation` loads them itself with `expo-font` and waits for them before the reveal, so there is nothing to set up.

## The 3D wordmark

`src/Wordmark.tsx` builds the wordmark from stacked copies of the text, so it needs no image assets or extra packages:

- **Glow:** a soft green halo behind the letters.
- **Depth:** seven darker copies stepped down and to the right, giving the letters and speed lines a solid extruded edge.
- **Face:** the letters, light grey for "Waka" and green for "100".
- **Lit top:** the upper half of each letter in a brighter shade, like light from above.
- **Shine:** a soft reflection that glides across once after the reveal.

All animation runs on the native driver.
