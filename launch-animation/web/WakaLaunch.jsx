import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Waka100 launch animation for React web apps (Base44, Vite, Next.js, ...).
 * One file, no dependencies besides React. Renders a full-screen overlay on
 * top of your app and removes itself when it has finished.
 *
 * 1. Shapes: a merged triangle and square tilt, split and level out, then a
 *    two-slot conveyor steps through triangle, square, circle every 0.4s
 *    (modelled on Uber's launch screen).
 * 2. Reveal: once `ready` is true, the shapes swing together and tilt, then
 *    cut to the 3D "WAKA100" wordmark in Orbitron (with the icon's green speed
 *    lines in front of the W). The letters rise into view one by one from the
 *    bottom up, then the word grows taller while a width wave rolls through
 *    the letters at a fixed overall width, and a shine glides across.
 * 3. Tagline: the letters collapse into dots one by one, the dots glide into
 *    an even row and the tagline rises out of them.
 * 4. The overlay fades out, revealing your app.
 *
 * Usage:
 *   <WakaLaunch />                                  plays once on load
 *   <WakaLaunch ready={dataLoaded} onDone={...} />  waits for your app
 */

// ---------------------------------------------------------------------------
// Timing (ms)

const MERGED_HOLD_MS = 120;
const TILT_MS = 70;
const SPLIT_MS = 280;
const SETTLE_MS = 250;
const MOVE_MS = 200;
const STEP_MS = 400;
const PASS_STEPS = 3;
const MERGE_MS = 220;
const RISE_MS = 450;
const RISE_HOLD_MS = 250;
const STRETCH_MS = 1800;
const SHINE_DELAY_MS = 150;
const SHINE_MS = 1100;
const COLLAPSE_DELAY_MS = 350;
const COLLAPSE_MS = 600;
const TRAVEL_MS = 450;
const TAGLINE_MS = 700;
const END_HOLD_MS = 900;
const FADE_OUT_MS = 450;

// ---------------------------------------------------------------------------
// Look

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=block';
const FONT = 'Orbitron, sans-serif';
// Orbitron's vertical metrics in em. The line box is exactly ascent + descent,
// so the baseline sits at the ascent.
const ASCENT = 1.011;
const DESCENT = 0.243;
const LINE_HEIGHT = ASCENT + DESCENT;
const CAP_HEIGHT = 0.72;
const BASELINE = ASCENT;
const CAP_TOP = BASELINE - CAP_HEIGHT;

const PALETTE = {
  waka: { highlight: '#FFFFFF', face: '#D3D6DC', sides: ['#8E9198', '#4A4C52'] },
  hundred: { highlight: '#B6F25E', face: '#7DD31E', sides: ['#4C9A08', '#21470A'] },
  glow: 'rgba(143, 220, 34, 0.55)',
  speedLines: '#8FDC22',
  speedLinesSide: '#2F6A05',
  shapeGreen: '#9BE52C',
  white: '#FFFFFF',
  tagline: '#ECEEF1',
};
const LETTERS = 'WAKA100'.split('').map((char, i) => ({ char, palette: i < 4 ? PALETTE.waka : PALETTE.hundred }));

const DEPTH_EM = 0.075;
const DEPTH_STEPS = 7;
const LETTER_SPACING_EM = -0.02;
const TALL_Y = 1.6;
const WAVE_AMPLITUDE = 0.45;
const WAVE_CYCLES = 1.5;
const WAVE_SAMPLES = 72;
const RISE_LETTER_SPAN = 0.5;
const COLLAPSE_LETTER_SPAN = 0.45;
const DOT_EM = 0.16;
const TILT_DEG = 40;
const MERGED_OFFSET = 0.3;
const TAGLINE_LETTER_SPACING_EM = 0.2;
const TAGLINE_WORD_GAP_EM = 0.55;
const TAGLINE_WORD_SPAN = 0.55;

// The icon's three green speed lines, in cap-height units (100 = cap height)
// from the W's left edge; each tucks under the W's slanted left stroke.
const SPEED_LINES = [
  { y: 72, from: -15, to: 37 },
  { y: 83, from: -49, to: 41 },
  { y: 94, from: -19, to: 45 },
];
const SPEED_LINE_THICKNESS = 7.5;
const SPEED_LINES_LEFT = -60;
const SPEED_LINES_WIDTH = 110;

// The conveyor runs triangle, square, circle twice so the shape leaving on the
// left is never the same element as the one arriving on the right.
const PASS = [
  { kind: 'triangle', color: PALETTE.shapeGreen },
  { kind: 'square', color: PALETTE.white },
  { kind: 'circle', color: PALETTE.white },
];
const SHAPES = [...PASS, ...PASS];
const N = SHAPES.length;

// ---------------------------------------------------------------------------
// Easing and interpolation

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOutSin: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  step: bezier(0.6, 0, 0.2, 1),
};

function bezier(x1, y1, x2, y2) {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (f(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return f(y1, y2, (lo + hi) / 2);
  };
}

/** Progress 0..1 of a phase that starts at `start` and lasts `duration`. */
const phase = (t, start, duration, easing = ease.linear) => easing(clamp01((t - start) / duration));

/** Letter `i`'s own progress within a phase that staggers left to right. */
function staggered(p, i, count, span, easing) {
  const start = count > 1 ? (i * (1 - span)) / (count - 1) : 0;
  return easing(clamp01((p - start) / span));
}

/** Where conveyor shape `n` sits at step `s`: centre offset in pitches, and scale. */
function slotState(n, s) {
  let p = n - s;
  while (p <= -N / 2) p += N;
  while (p > N / 2) p -= N;
  if (p <= -1 || p >= 2) return { x: p < 0 ? -1 : 1, scale: 0 };
  if (p < 0) return { x: -1 + (1 + p) / 2, scale: 1 + p }; // leaving: shrinks against the left edge
  if (p <= 1) return { x: -0.5 + p, scale: 1 };
  return { x: 1 - (2 - p) / 2, scale: 2 - p }; // arriving: grows from the right edge
}

/**
 * The width wave over the 0..1 stretch phase. A swell travels left to right
 * through the letters; each sample is rescaled so the letters' widths add up
 * to the word's natural width, so letters trade width and the word never grows
 * or shrinks. Returns per-sample horizontal scales and the shifts that keep the
 * letters packed.
 */
function widthWave(widths) {
  const n = widths.length;
  const natural = widths.reduce((a, b) => a + b, 0);
  const scaleX = widths.map(() => []);
  const shift = widths.map(() => []);
  for (let k = 0; k <= WAVE_SAMPLES; k++) {
    const u = k / WAVE_SAMPLES;
    const envelope = Math.sin(Math.PI * u) ** 0.6;
    const raw = widths.map((_, j) => 1 + WAVE_AMPLITUDE * envelope * Math.sin(2 * Math.PI * (WAVE_CYCLES * u - j / n)));
    const fit = natural / widths.reduce((sum, w, j) => sum + w * raw[j], 0);
    let left = 0;
    for (let j = 0; j < n; j++) {
      const sx = raw[j] * fit;
      const delta = widths[j] * (sx - 1);
      scaleX[j].push(sx);
      shift[j].push(left + delta / 2);
      left += delta;
    }
  }
  return { scaleX, shift };
}

function sample(table, u) {
  const x = clamp01(u) * WAVE_SAMPLES;
  const k = Math.min(WAVE_SAMPLES - 1, Math.floor(x));
  return lerp(table[k], table[k + 1], x - k);
}

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// Pieces

function Shape({ kind, color, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      {kind === 'triangle' && <polygon points="50,4 100,96 0,96" fill={color} />}
      {kind === 'square' && <rect x="4" y="4" width="92" height="92" fill={color} />}
      {kind === 'circle' && <circle cx="50" cy="50" r="48" fill={color} />}
    </svg>
  );
}

/** Speed lines against the W's left edge, with the same extruded edge as the letters. */
function SpeedLines({ size }) {
  const cap = CAP_HEIGHT * size;
  const t = SPEED_LINE_THICKNESS;
  const unit = 100 / cap; // px -> viewBox units
  const depth = DEPTH_EM * size;
  const lines = (dx, dy, color, key) =>
    SPEED_LINES.map(({ y, from, to }) => (
      <polygon
        key={`${key}-${y}`}
        transform={`translate(${dx * unit} ${dy * unit})`}
        points={`${from},${y - t * 0.1} ${to},${y - t / 2} ${to},${y + t / 2} ${from},${y + t * 0.2}`}
        fill={color}
      />
    ));
  const steps = Array.from({ length: DEPTH_STEPS }, (_, i) => DEPTH_STEPS - i);
  return (
    <svg
      width={(SPEED_LINES_WIDTH / 100) * cap}
      height={cap * 1.2}
      viewBox={`${SPEED_LINES_LEFT} 0 ${SPEED_LINES_WIDTH} 120`}
      style={{ position: 'absolute', left: (SPEED_LINES_LEFT / 100) * cap, top: CAP_TOP * size, overflow: 'visible' }}
    >
      {steps.map((s) => lines((depth * s) / DEPTH_STEPS / 2, (depth * s) / DEPTH_STEPS, PALETTE.speedLinesSide, s))}
      {lines(0, 0, PALETTE.speedLines, 'face')}
    </svg>
  );
}

// ---------------------------------------------------------------------------

export default function WakaLaunch({
  ready = true,
  minCycles = 2,
  tagline = 'YOUR RIDE, YOUR RULES!',
  onDone,
  haptics = true,
  fadeOut = true,
  zIndex = 9999,
}) {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
  }));
  const [fontsReady, setFontsReady] = useState(false);
  const [layout, setLayout] = useState(null);
  const [gone, setGone] = useState(false);

  const readyRef = useRef(ready);
  readyRef.current = ready && fontsReady;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const overlayRef = useRef(null);
  const conveyorRef = useRef(null);
  const shapeRefs = useRef([]);
  const rowRef = useRef(null);
  const slotRefs = useRef([]);
  const bodyRefs = useRef([]);
  const faceRefs = useRef([]);
  const dotRefs = useRef([]);
  const taglineRef = useRef(null);
  const wordRefs = useRef([]);

  // Sizes follow the screen width, capped for tablets and desktops.
  const width = Math.min(viewport.width, 560);
  const size = Math.min(width * 0.125, 60) + 1;
  const taglineSize = Math.min(width * 0.045, 22);
  const shapeSize = Math.min(width * 0.14, 64) * 0.78;
  const pitch = shapeSize * 1.08;
  const words = tagline.split(' ');

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load Orbitron from Google Fonts (once per page).
  useEffect(() => {
    if (!document.querySelector('link[data-waka-font]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_URL;
      link.setAttribute('data-waka-font', '');
      document.head.appendChild(link);
    }
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    Promise.all([document.fonts.load(`900 ${size}px Orbitron`), document.fonts.load(`500 ${taglineSize}px Orbitron`)])
      .then(finish)
      .catch(finish);
    // Never hold the app back for a slow font.
    const timer = setTimeout(finish, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure the letters once the font is in.
  useLayoutEffect(() => {
    if (!fontsReady || !rowRef.current) return;
    const letters = slotRefs.current.map((el) => ({ x: el.offsetLeft, w: el.offsetWidth }));
    setLayout({
      wordWidth: rowRef.current.offsetWidth,
      letters,
      wave: widthWave(letters.map((l) => l.w)),
      taglineWidth: taglineRef.current ? taglineRef.current.offsetWidth : 0,
    });
  }, [fontsReady, size, taglineSize, tagline]);

  // The animation loop: every frame is computed from the elapsed time.
  useEffect(() => {
    if (!layout) return undefined;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    const conveyorStart = start + MERGED_HOLD_MS + TILT_MS + SPLIT_MS + SETTLE_MS;
    let revealAt = null; // when the reveal starts
    let checkedPasses = 0;
    let vibrated = false;
    let doneCalled = false;
    let frame;

    const { wordWidth, letters, wave, taglineWidth } = layout;
    const n = LETTERS.length;
    const middle = (BASELINE - (CAP_HEIGHT * TALL_Y) / 2) * size;
    const toMiddle = middle - BASELINE * size;
    const span = taglineWidth || wordWidth * 0.8;
    const clipExtra = 0.8; // em of room for glow, extrusion and stretched letters

    const cut = MERGE_MS + MERGED_HOLD_MS;
    const tRise = cut;
    const tStretch = tRise + RISE_MS + RISE_HOLD_MS;
    const tShine = tStretch + STRETCH_MS + SHINE_DELAY_MS;
    const tCollapse = tShine + SHINE_MS + COLLAPSE_DELAY_MS;
    const tTravel = tCollapse + COLLAPSE_MS;
    const tTagline = tTravel + TRAVEL_MS;
    const tEnd = tTagline + TAGLINE_MS + END_HOLD_MS;
    // With reduced motion, skip straight to the tagline and its hold.
    if (reduceMotion) revealAt = start - (tTagline + TAGLINE_MS);

    const draw = (now) => {
      // --- Shapes -----------------------------------------------------------
      let s = 0;
      let split = 1;
      let tilt = 0;
      if (now < conveyorStart) {
        const t = now - start;
        const tiltIn = phase(t, MERGED_HOLD_MS, TILT_MS, ease.outQuad);
        const splitP = phase(t, MERGED_HOLD_MS + TILT_MS, SPLIT_MS, ease.outCubic);
        split = splitP;
        tilt = tiltIn * (1 - splitP);
      } else {
        // Decide at each completed pass whether to start the reveal.
        const passes = Math.floor((now - conveyorStart) / (PASS_STEPS * STEP_MS));
        while (revealAt === null && checkedPasses < passes) {
          checkedPasses += 1;
          if (readyRef.current && checkedPasses >= minCycles) {
            revealAt = conveyorStart + checkedPasses * PASS_STEPS * STEP_MS;
          }
        }
        const elapsed = (revealAt === null ? now : Math.max(revealAt, conveyorStart)) - conveyorStart;
        const k = Math.floor(elapsed / STEP_MS);
        s = (k + ease.step(clamp01((elapsed - k * STEP_MS) / MOVE_MS))) % N;
      }

      // --- Reveal timeline ----------------------------------------------------
      const r = revealAt === null ? -1 : now - revealAt;
      if (r >= 0) {
        const merge = phase(r, 0, MERGE_MS, ease.inCubic);
        split = 1 - merge;
        tilt = merge;
      }
      const showShapes = r < cut;

      const rise = r < 0 ? 0 : phase(r, tRise, RISE_MS);
      const stretch = r < 0 ? 0 : phase(r, tStretch, STRETCH_MS);
      const shine = r < 0 ? 0 : phase(r, tShine, SHINE_MS, ease.inOutQuad);
      const collapse = r < 0 ? 0 : phase(r, tCollapse, COLLAPSE_MS);
      const travel = r < 0 ? 0 : phase(r, tTravel, TRAVEL_MS, ease.inOutCubic);
      const taglineP = r < 0 ? 0 : phase(r, tTagline, TAGLINE_MS);

      if (r >= cut && !vibrated && !reduceMotion) {
        vibrated = true;
        // Browsers only allow vibration after the user has tapped the page.
        if (haptics && navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(25);
      }

      // Conveyor.
      conveyorRef.current.style.opacity = showShapes ? '1' : '0';
      conveyorRef.current.style.transform = `rotate(${-TILT_DEG * tilt}deg)`;
      const spread = lerp(MERGED_OFFSET, 1, split);
      SHAPES.forEach((_, i) => {
        const st = slotState(i, s);
        const el = shapeRefs.current[i];
        el.style.opacity = String(st.scale);
        el.style.transform = `translateX(${st.x * pitch * spread}px) scale(${st.scale})`;
      });

      // Wordmark.
      const sy = lerp(1, TALL_Y, ease.inOutSin(stretch));
      rowRef.current.style.transform = `translateY(${(CAP_HEIGHT * size * (sy - 1)) / 2}px)`;
      const shineX = lerp(-(wordWidth / 2 + 2 * size), wordWidth / 2 + 2 * size, shine);
      LETTERS.forEach((_, i) => {
        const ri = staggered(rise, i, n, RISE_LETTER_SPAN, ease.outCubic);
        const ci = staggered(collapse, i, n, COLLAPSE_LETTER_SPAN, ease.inCubic);
        const sx = sample(wave.scaleX[i], stretch);
        const pack = sample(wave.shift[i], stretch);
        const body = bodyRefs.current[i];
        // Bottom-up reveal: clip from the top, extended past the sides and bottom
        // so the glow and depth show once risen.
        const top = (1 - ri) * (LINE_HEIGHT + 2 * clipExtra) - clipExtra;
        body.style.clipPath = `inset(${top * size}px -${clipExtra * 1.5 * size}px -${clipExtra * size}px -${clipExtra * 1.5 * size}px)`;
        body.style.opacity = ri > 0 ? '1' : '0';
        // Stretch about the baseline; collapse towards the middle of the stretched letter.
        body.style.transform =
          `translateX(${pack}px) translateY(${toMiddle}px) scale(${1 - ci}) translateY(${-toMiddle}px) ` +
          `scale(${sx}, ${sy})`;
        // Shine band across the whole word, positioned in this letter's coordinates.
        const face = faceRefs.current[i];
        face.style.backgroundPosition = `${-letters[i].x + shineX}px 0, 0 0`;
        // Dot.
        const dotScale = clamp01((ci - 0.55) / 0.45) * (1 - taglineP);
        const from = letters[i].x + letters[i].w / 2;
        const to = wordWidth / 2 - span / 2 + (span * i) / (n - 1);
        const dot = dotRefs.current[i];
        dot.style.transform = `translateX(${lerp(0, to - from, travel)}px) scale(${dotScale})`;
      });

      // Tagline.
      words.forEach((_, i) => {
        const wi = staggered(taglineP, i, words.length, TAGLINE_WORD_SPAN, ease.outCubic);
        const el = wordRefs.current[i];
        el.style.clipPath = `inset(${(1 - wi) * 100}% 0 0 0)`;
        el.style.opacity = wi > 0 ? '1' : '0';
      });

      // End.
      if (r >= tEnd && !doneCalled) {
        doneCalled = true;
        onDoneRef.current?.();
      }
      if (fadeOut && r >= tEnd) {
        const f = phase(r, tEnd, FADE_OUT_MS, ease.inOutCubic);
        overlayRef.current.style.opacity = String(1 - f);
        if (f >= 1) {
          setGone(true);
          return;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  if (gone) return null;

  const depth = DEPTH_EM * size;
  const extrusion = (palette) =>
    Array.from({ length: DEPTH_STEPS }, (_, k) => {
      const t = (k + 1) / DEPTH_STEPS;
      const off = depth * t;
      return `${off * 0.5}px ${off}px 0 ${mix(palette.sides[0], palette.sides[1], t)}`;
    });
  const letterText = {
    fontFamily: FONT,
    fontWeight: 900,
    fontSize: size,
    lineHeight: `${LINE_HEIGHT * size}px`,
    whiteSpace: 'pre',
    display: 'block',
  };
  const bevel = ((CAP_TOP + CAP_HEIGHT * 0.5) / LINE_HEIGHT) * 100;
  const shineBand = (wordWidth) => {
    const c = wordWidth / 2;
    const em = size;
    return (
      `linear-gradient(90deg, rgba(255,255,255,0) ${c - 0.5 * em}px, rgba(255,255,255,0.22) ${c - 0.18 * em}px, ` +
      `rgba(255,255,255,0.75) ${c}px, rgba(255,255,255,0.22) ${c + 0.18 * em}px, rgba(255,255,255,0) ${c + 0.5 * em}px)`
    );
  };
  const wordWidth = layout ? layout.wordWidth : 0;

  return (
    <div
      ref={overlayRef}
      role="img"
      aria-label={`Waka100. ${tagline}`}
      style={{ position: 'fixed', inset: 0, zIndex, background: '#000', overflow: 'hidden' }}
    >
      {/* Shapes */}
      <div style={styles.center}>
        <div ref={conveyorRef} style={{ position: 'relative', width: 0, height: shapeSize }}>
          {SHAPES.map(({ kind, color }, i) => (
            <div
              key={i}
              ref={(el) => (shapeRefs.current[i] = el)}
              style={{ position: 'absolute', left: -shapeSize / 2, top: 0, opacity: 0 }}
            >
              <Shape kind={kind} color={color} size={shapeSize} />
            </div>
          ))}
        </div>
      </div>

      {/* Wordmark */}
      <div style={{ ...styles.center, visibility: layout ? 'visible' : 'hidden' }}>
        <div ref={rowRef} style={{ position: 'relative', display: 'flex' }}>
          {LETTERS.map(({ char, palette }, i) => (
            <div
              key={i}
              ref={(el) => (slotRefs.current[i] = el)}
              style={{ position: 'relative', marginRight: i < LETTERS.length - 1 ? LETTER_SPACING_EM * size : 0 }}
            >
              {/* Invisible copy that gives the letter its place in the row. */}
              <span style={{ ...letterText, visibility: 'hidden' }}>{char}</span>
              <div
                ref={(el) => (bodyRefs.current[i] = el)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  opacity: 0,
                  transformOrigin: `50% ${BASELINE * size}px`,
                  willChange: 'transform, clip-path',
                }}
              >
                {/* Depth and glow */}
                <span
                  style={{
                    ...letterText,
                    color: palette.sides[0],
                    textShadow: [...extrusion(palette), `0 0 ${0.35 * size}px ${PALETTE.glow}`].join(', '),
                  }}
                >
                  {char}
                </span>
                {i === 0 && <SpeedLines size={size} />}
                {/* Face: lit top half over a darker bottom half, plus the shine band */}
                <span
                  ref={(el) => (faceRefs.current[i] = el)}
                  style={{
                    ...letterText,
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    color: 'transparent',
                    backgroundImage:
                      `${shineBand(wordWidth)}, ` +
                      `linear-gradient(180deg, ${palette.highlight} 0%, ${palette.highlight} ${bevel}%, ${palette.face} ${bevel}%, ${palette.face} 100%)`,
                    backgroundSize: `${wordWidth}px 100%, 100% 100%`,
                    backgroundRepeat: 'no-repeat',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                  }}
                >
                  {char}
                </span>
              </div>
            </div>
          ))}

          {/* Dots, one per letter */}
          {layout &&
            LETTERS.map(({ palette }, i) => {
              const d = DOT_EM * size;
              const l = layout.letters[i];
              return (
                <div
                  key={`dot${i}`}
                  ref={(el) => (dotRefs.current[i] = el)}
                  style={{
                    position: 'absolute',
                    left: l.x + l.w / 2 - d / 2,
                    top: (BASELINE - (CAP_HEIGHT * TALL_Y) / 2) * size - d / 2,
                    width: d,
                    height: d,
                    borderRadius: '50%',
                    background: palette.face,
                    transform: 'scale(0)',
                  }}
                />
              );
            })}
        </div>
      </div>

      {/* Tagline */}
      <div style={styles.center}>
        <div ref={taglineRef} style={{ display: 'flex', columnGap: TAGLINE_WORD_GAP_EM * taglineSize }}>
          {words.map((word, i) => (
            <span
              key={i}
              ref={(el) => (wordRefs.current[i] = el)}
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: taglineSize,
                lineHeight: `${LINE_HEIGHT * taglineSize}px`,
                letterSpacing: TAGLINE_LETTER_SPACING_EM * taglineSize,
                color: PALETTE.tagline,
                whiteSpace: 'pre',
                opacity: 0,
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
};
