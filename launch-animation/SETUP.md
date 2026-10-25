# Adding the Waka100 launch animation to your app

Works in any Expo (or React Native with Expo modules) project.

## 1. Copy the files

Copy the `components/LaunchAnimation/` folder into your project's `components/`
folder. Keep the `fonts/` folder inside it.

## 2. Install the dependencies

```sh
npx expo install react-native-svg expo-haptics expo-font
```

## 3. Show it at start-up

See `App.example.tsx`. In short:

```tsx
import { LaunchAnimation } from './components/LaunchAnimation';

<LaunchAnimation
  ready={appReady}                    // true once your app has finished loading
  onDone={() => setShowLaunch(false)} // then show the rest of the app
/>
```

The shapes keep looping until `ready` is true. Then WAKA100 is revealed, collapses
into dots, and "YOUR RIDE, YOUR RULES!" appears. `onDone` fires after the tagline.

## 4. Make the phone's own splash screen black

Before your code runs, the phone shows its built-in splash screen. Make it black
so there is no flash before the animation. In `app.json`:

```json
{
  "expo": {
    "splash": { "backgroundColor": "#000000" },
    "android": { "splash": { "backgroundColor": "#000000" } }
  }
}
```

## 5. Rebuild

`expo-haptics` and `expo-font` include native code, so make a new development
build (`npx expo run:ios` / `npx expo run:android`, or a new EAS build). Expo Go
already includes both.

## Options

| Prop | Default | |
| --- | --- | --- |
| `ready` | — | The shapes loop until this is `true`. |
| `minCycles` | `2` | Minimum passes of the shapes (1.2s each) before the reveal. |
| `onDone` | — | Called when the animation has finished. |
| `tagline` | `"YOUR RIDE, YOUR RULES!"` | The closing line. |
| `fontSize` | 12.5% of screen width (max 60), plus 1 | WAKA100 size in px. |
| `haptics` | `true` | Short vibration when WAKA100 appears. |
| `backgroundColor` | `#000000` | Screen colour. |
| `renderLogin` | — | Optional screen to cross-fade to at the end. |

The full timeline is in `README.md`.
