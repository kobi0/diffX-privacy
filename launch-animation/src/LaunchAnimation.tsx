import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { COLORS } from './WakaLogo';

/**
 * Uber-style launch animation for Waka100.
 *
 * 1. The "Waka100" wordmark holds on screen.
 * 2. Hard cut: the letters collapse into one merged glyph ("W" over "a"),
 *    which tilts, splits in two and swings back level.
 *    The "W" always carries the icon's green speed lines on its left.
 * 3. Loader: a two-slot conveyor. Every step the left character shrinks and
 *    fades out against the left edge, the right one slides into its place and
 *    the next character grows in from the right edge. It runs through every
 *    letter and number: W a k a 1 0 0 W a ...
 */

const CHARS: Array<{ char: string; color: string }> = [
  { char: 'W', color: COLORS.white },
  { char: 'a', color: COLORS.white },
  { char: 'k', color: COLORS.white },
  { char: 'a', color: COLORS.white },
  { char: '1', color: COLORS.textGreenTop },
  { char: '0', color: COLORS.textGreenTop },
  { char: '0', color: COLORS.textGreenTop },
];
const N = CHARS.length;

/** One conveyor step: a fast slide, then a short hold (matches Uber's 0.4s beat). */
const MOVE_MS = 200;
const HOLD_MS = 200;
export const STEP_MS = MOVE_MS + HOLD_MS;
/** One full pass through all seven characters. */
export const CYCLE_MS = N * STEP_MS;

const WORDMARK_HOLD_MS = 900;
const MERGED_HOLD_MS = 50;
const TILT_MS = 70;
const SPLIT_MS = 280;
const SETTLE_MS = 250;
const TILT_DEG = 40;
const EXIT_MS = 450;

const STEP_EASING = Easing.bezier(0.6, 0, 0.2, 1);

// iOS and Android use the system font (SF Pro / Roboto) at its heaviest weight.
const FONT_FAMILY = Platform.select({
  ios: undefined,
  android: 'sans-serif',
  default: 'Inter, "Helvetica Neue", Arial, sans-serif',
});
const FONT_WEIGHT = '900';

// Glyph metrics shared by SF Pro, Roboto and Inter, in em, for a line height of 1.2em.
const CAP_TOP = 0.24;
const CAP_HEIGHT = 0.715;

/**
 * The three green speed lines from the icon, in cap-height units (100 = cap
 * height) measured from the W's left edge. Each line is tapered to a point on
 * the left and its right end tucks under the W's slanted left stroke.
 */
const SPEED_LINES = [
  { y: 72, from: -22, to: 30 },
  { y: 83, from: -58, to: 32 },
  { y: 94, from: -30, to: 34 },
];
const SPEED_LINE_THICKNESS = 7.5;
const SPEED_LINES_LEFT = -60;
const SPEED_LINES_WIDTH = 95;

/** Speed lines positioned against the left edge of a text box whose first glyph is "W". */
function SpeedLines({ fontSize }: { fontSize: number }) {
  const cap = CAP_HEIGHT * fontSize;
  const t = SPEED_LINE_THICKNESS;
  return (
    <Svg
      pointerEvents="none"
      width={(SPEED_LINES_WIDTH / 100) * cap}
      height={cap}
      viewBox={`${SPEED_LINES_LEFT} 0 ${SPEED_LINES_WIDTH} 100`}
      style={{
        position: 'absolute',
        left: (SPEED_LINES_LEFT / 100) * cap,
        top: CAP_TOP * fontSize,
      }}
    >
      {SPEED_LINES.map(({ y, from, to }) => (
        <Polygon
          key={y}
          points={`${from},${y - t * 0.1} ${to},${y - t / 2} ${to},${y + t / 2} ${from},${y + t * 0.2}`}
          fill={COLORS.greenMid}
        />
      ))}
    </Svg>
  );
}

export type LaunchAnimationProps = {
  /** true once the app has finished starting up (fonts, auth check, ...). */
  ready: boolean;
  /** Shortest loader run, in full passes through "Waka100" (2.8s each), before handing off. */
  minCycles?: number;
  /** Screen faded in underneath when the animation hands off. */
  renderLogin?: () => React.ReactNode;
  /** Called once the hand-off transition has finished. */
  onDone?: () => void;
  /** Character size in px. Defaults to 14% of the screen width (max 64), plus 1. */
  fontSize?: number;
  backgroundColor?: string;
};

/**
 * Where character `n` sits when the conveyor is at step `s`. Returns its centre
 * offset in pitches (relative to the middle of the two slots) and its scale,
 * which doubles as opacity. Piecewise linear in `s`.
 */
function charState(n: number, s: number) {
  let p = n - s;
  // The conveyor is a ring of N characters.
  while (p <= -N / 2) p += N;
  while (p > N / 2) p -= N;
  const left = -1; // left edge of the left slot
  const right = 1; // right edge of the right slot
  if (p <= -1 || p >= 2) return { x: p < 0 ? left : right, scale: 0 };
  if (p < 0) {
    // Leaving: shrinks against the left edge.
    const scale = 1 + p;
    return { x: left + scale / 2, scale };
  }
  if (p <= 1) return { x: -0.5 + p, scale: 1 };
  // Arriving: grows from the right edge.
  const scale = 2 - p;
  return { x: right - scale / 2, scale };
}

/** Exact piecewise-linear interpolation table for character `n` over s ∈ [0, N]. */
function charTable(n: number) {
  const knots = new Set<number>([0, N]);
  for (const pk of [-1, 0, 1, 2]) {
    for (const m of [-1, 0, 1]) {
      const s = n - pk + m * N;
      if (s > 0 && s < N) knots.add(s);
    }
    // Wrap boundaries of the ring, where `p` jumps.
  }
  for (const m of [-1, 0, 1]) {
    const s = n + N / 2 + m * N;
    if (s > 0 && s < N) {
      knots.add(s - 1e-4);
      knots.add(s + 1e-4);
    }
  }
  const inputRange = [...knots].sort((a, b) => a - b);
  const states = inputRange.map((s) => charState(n, s));
  return { inputRange, x: states.map((st) => st.x), scale: states.map((st) => st.scale) };
}

export function LaunchAnimation({
  ready,
  minCycles = 1,
  renderLogin,
  onDone,
  fontSize,
  backgroundColor = '#000000',
}: LaunchAnimationProps) {
  const { width } = useWindowDimensions();
  const size = fontSize ?? Math.min(width * 0.14, 64) + 1;
  const pitch = size * 0.72;

  const step = useRef(new Animated.Value(0)).current; // conveyor position, 0..N
  const split = useRef(new Animated.Value(0)).current; // 0 = merged glyph, 1 = two slots
  const tilt = useRef(new Animated.Value(0)).current; // 0..1 of TILT_DEG
  const exit = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<'wordmark' | 'loader' | 'exiting' | 'done'>('wordmark');
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const cyclesRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const waitingForReadyRef = useRef(false);
  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(() => mounted.current && fn(), ms));
  };

  const runExit = useCallback(() => {
    if (!mounted.current) return;
    setPhase('exiting');
    Animated.timing(exit, {
      toValue: 1,
      duration: EXIT_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !mounted.current) return;
      setPhase('done');
      onDoneRef.current?.();
    });
  }, [exit]);

  const runStep = useCallback(
    (k: number) => {
      Animated.sequence([
        Animated.timing(step, {
          toValue: k + 1,
          duration: MOVE_MS,
          easing: STEP_EASING,
          useNativeDriver: true,
        }),
        Animated.delay(HOLD_MS),
      ]).start(({ finished }) => {
        if (!finished || !mounted.current) return;
        let next = k + 1;
        if (next === N) {
          // Back to the start of the ring; visually identical.
          step.setValue(0);
          next = 0;
          cyclesRef.current += 1;
          if (readyRef.current && cyclesRef.current >= minCycles) {
            runExit();
            return;
          }
        }
        runStep(next);
      });
    },
    [step, minCycles, runExit],
  );

  // Wordmark -> merged glyph -> tilt -> split and level -> conveyor.
  const runIntro = useCallback(() => {
    later(() => {
      setPhase('loader');
      Animated.sequence([
        Animated.delay(MERGED_HOLD_MS),
        Animated.timing(tilt, { toValue: 1, duration: TILT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(split, { toValue: 1, duration: SPLIT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 0, duration: SPLIT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(SETTLE_MS),
      ]).start(({ finished }) => {
        if (finished && mounted.current) runStep(0);
      });
    }, WORDMARK_HOLD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilt, split, runStep]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        reduceMotionRef.current = reduce;
        if (reduce) {
          // Keep the wordmark still and hand off as soon as the app is ready.
          if (readyRef.current) runExit();
          else waitingForReadyRef.current = true;
          return;
        }
        runIntro();
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      step.stopAnimation();
      split.stopAnimation();
      tilt.stopAnimation();
      exit.stopAnimation();
    };
    // Run once on mount; later prop changes are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && waitingForReadyRef.current) {
      waitingForReadyRef.current = false;
      runExit();
    }
  }, [ready, runExit]);

  const charStyles = useMemo(
    () =>
      CHARS.map((_, n) => {
        const table = charTable(n);
        const x = step.interpolate({
          inputRange: table.inputRange,
          outputRange: table.x.map((v) => v * pitch),
        });
        const scale = step.interpolate({ inputRange: table.inputRange, outputRange: table.scale });
        return {
          opacity: scale,
          // Before the split both visible characters share the centre.
          transform: [{ translateX: Animated.multiply(x, split) }, { scale }],
        };
      }),
    [step, split, pitch],
  );

  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `-${TILT_DEG}deg`] });
  const textStyle = { fontSize: size, lineHeight: size * 1.2, fontFamily: FONT_FAMILY };

  return (
    <View style={styles.fill}>
      {(phase === 'exiting' || phase === 'done') && renderLogin && (
        <Animated.View style={[styles.fill, { opacity: exit }]}>{renderLogin()}</Animated.View>
      )}
      {phase !== 'done' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor, opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}
          pointerEvents={phase === 'exiting' ? 'none' : 'auto'}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Waka100 is loading"
        >
          {phase === 'wordmark' || (phase === 'exiting' && reduceMotionRef.current) ? (
            <View>
              <SpeedLines fontSize={size} />
              <Text style={[styles.char, textStyle, styles.wordmark]}>
                <Text style={{ color: COLORS.white }}>Waka</Text>
                <Text style={{ color: COLORS.textGreenTop }}>100</Text>
              </Text>
            </View>
          ) : (
            <Animated.View style={[styles.conveyor, { height: size * 1.2, transform: [{ rotate }] }]}>
              {CHARS.map(({ char, color }, n) => (
                <Animated.View
                  key={n}
                  style={[
                    styles.slot,
                    { width: pitch * 1.4, marginLeft: -pitch * 0.7, height: size * 1.2 },
                    charStyles[n],
                  ]}
                >
                  <View>
                    {char === 'W' && <SpeedLines fontSize={size} />}
                    <Text style={[styles.char, textStyle, { color }]}>{char}</Text>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  conveyor: { width: 0, alignItems: 'center' },
  slot: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  char: { fontWeight: FONT_WEIGHT, includeFontPadding: false, textAlign: 'center' },
  wordmark: { letterSpacing: -1 },
});

export default LaunchAnimation;
