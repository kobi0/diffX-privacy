# Adding the Waka100 launch animation to a Base44 app

Base44 apps are React web apps, so use `WakaLaunch.jsx`. It is one file with
no packages to install: it only needs React, which every Base44 app has, and
it loads the Orbitron font from Google Fonts by itself.

## Option A: with the code editor

1. Create a new file `components/WakaLaunch.jsx` and paste in the whole of
   `WakaLaunch.jsx`.
2. Open `Layout.js` (the file that wraps every page) and add:

   ```jsx
   import WakaLaunch from "@/components/WakaLaunch";
   ```

   and, as the first thing inside the layout's outermost element:

   ```jsx
   <WakaLaunch />
   ```

That's it. When the app opens, the animation covers the screen, plays, and
fades away to reveal your app.

## Option B: through the Base44 chat

Attach `WakaLaunch.jsx` (or paste it) and send:

> Create a new component file `components/WakaLaunch.jsx` containing exactly
> the attached code. Do not change, shorten or rewrite any of it. Then import it
> in `Layout.js` with `import WakaLaunch from "@/components/WakaLaunch";` and
> render `<WakaLaunch />` once, as the first child of the layout's outermost
> element. Don't change anything else.

Then open the file and check the AI kept all ~640 lines, since AI editors
sometimes trim long code.

## Waiting for your data (optional)

By default the shapes play twice (2.4s) and then the reveal starts. To keep the
shapes going until your app has loaded something, pass `ready`:

```jsx
const [userLoaded, setUserLoaded] = useState(false);
// ... set it to true when your data has arrived
<WakaLaunch ready={userLoaded} />
```

## Options

| Prop | Default | |
| --- | --- | --- |
| `ready` | `true` | The shapes keep looping until this is `true`. |
| `minCycles` | `2` | Minimum passes of the shapes (1.2s each) before the reveal. |
| `tagline` | `"YOUR RIDE, YOUR RULES!"` | The closing line. |
| `onDone` | — | Called when the tagline has been shown. |
| `fadeOut` | `true` | Fade the overlay out at the end and remove it. Set `false` to keep the tagline on screen. |
| `haptics` | `true` | Short vibration when WAKA100 appears, on Android phones only, and only once the user has tapped the page (a browser rule). |
| `zIndex` | `9999` | Raise it if something in your app shows on top of the animation. |

## Notes

- It plays every time the app is opened or the page is refreshed, like a
  mobile app's launch screen. It does not replay when moving between pages.
- With the phone's "reduce motion" setting on, it skips straight to the tagline.
- Sizes follow the screen width and are capped on tablets and desktops.
