import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { COLORS } from './WakaLogo';
import { Wordmark } from './Wordmark';

/**
 * Uber-style launch animation for Waka100.
 *
 * 1. A merged shape (triangle over square) tilts, splits in two and swings
 *    back level.
 * 2. Loader: a two-slot conveyor. Every step the left shape shrinks and fades
 *    out against the left edge, the right one slides into its place and the
 *    next shape grows in from the right edge: triangle, square, circle, ...
 * 3. Reveal: once the app is ready, the two shapes swing back together and
 *    tilt, then hard-cut to the 3D "Waka100" wordmark (with the icon's green
 *    speed lines in front of the W), with a short vibration. A shine sweeps
 *    across it and the animation ends on the wordmark.
 */

type ShapeKind = 'triangle' | 'square' | 'circle';
const PASS: Array<{ kind: ShapeKind; color: string }> = [
  { kind: 'triangle', color: COLORS.textGreenTop },
  { kind: 'square', color: COLORS.white },
  { kind: 'circle', color: COLORS.white },
];
// The conveyor needs at least four items so the shape leaving on the left is
// never the same view as the one arriving on the right, so the pass runs twice.
const SHAPES = [...PASS, ...PASS];
const N = SHAPES.length;

/** One conveyor step: a fast slide, then a short hold (matches Uber's 0.4s beat). */
const MOVE_MS = 200;
const HOLD_MS = 200;
export const STEP_MS = MOVE_MS + HOLD_MS;
/** One full pass through triangle, square and circle. */
export const CYCLE_MS = PASS.length * STEP_MS;

const WORDMARK_HOLD_MS = 1300;
const SHINE_DELAY_MS = 150;
const SHINE_MS = 750;
const MERGED_HOLD_MS = 120;
const TILT_MS = 70;
const SPLIT_MS = 280;
const SETTLE_MS = 250;
const MERGE_MS = 220;
/** How far apart the two merged shapes sit, as a fraction of their split distance. */
const MERGED_OFFSET = 0.3;
const TILT_DEG = 40;
const EXIT_MS = 450;

const STEP_EASING = Easing.bezier(0.6, 0, 0.2, 1);

function Shape({ kind, color, size }: { kind: ShapeKind; color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {kind === 'triangle' && <Polygon points="50,4 100,96 0,96" fill={color} />}
      {kind === 'square' && <Rect x="4" y="4" width="92" height="92" fill={color} />}
      {kind === 'circle' && <Circle cx="50" cy="50" r="48" fill={color} />}
    </Svg>
  );
}

export type LaunchAnimationProps = {
  /** true once the app has finished starting up (fonts, auth check, ...). */
  ready: boolean;
  /** Shortest loader run, in full passes through triangle, square and circle (1.2s each), before the reveal. */
  minCycles?: number;
  /**
   * Optional screen to cross-fade to after the Waka100 reveal. Leave it out and
   * the animation ends on the wordmark, which stays on screen.
   */
  renderLogin?: () => React.ReactNode;
  /** Called when the animation has finished: after the wordmark hold, or after the cross-fade when `renderLogin` is given. */
  onDone?: () => void;
  /** Wordmark size in px. Defaults to 15% of the screen width (max 72), plus 1. */
  fontSize?: number;
  backgroundColor?: string;
  /** Vibrate briefly when the wordmark appears (default true). */
  haptics?: boolean;
};

/**
 * Where shape `n` sits when the conveyor is at step `s`. Returns its centre
 * offset in pitches (relative to the middle of the two slots) and its scale,
 * which doubles as opacity. Piecewise linear in `s`.
 */
function slotState(n: number, s: number) {
  let p = n - s;
  // The conveyor is a ring of N shapes.
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

/** Exact piecewise-linear interpolation table for shape `n` over s ∈ [0, N]. */
function slotTable(n: number) {
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
  const states = inputRange.map((s) => slotState(n, s));
  return { inputRange, x: states.map((st) => st.x), scale: states.map((st) => st.scale) };
}

export function LaunchAnimation({
  ready,
  minCycles = 2,
  renderLogin,
  onDone,
  fontSize,
  backgroundColor = '#000000',
  haptics = true,
}: LaunchAnimationProps) {
  const { width } = useWindowDimensions();
  const size = fontSize ?? Math.min(width * 0.15, 72) + 1;
  const shapeSize = Math.min(width * 0.14, 64) * 0.78;
  const pitch = shapeSize * 1.08;

  const step = useRef(new Animated.Value(0)).current; // conveyor position, 0..N
  const split = useRef(new Animated.Value(0)).current; // 0 = merged shape, 1 = two slots
  const tilt = useRef(new Animated.Value(0)).current; // 0..1 of TILT_DEG
  const shine = useRef(new Animated.Value(0)).current; // 0..1: highlight sweeps across the wordmark
  const exit = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<'loader' | 'wordmark' | 'exiting' | 'done'>('loader');
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const renderLoginRef = useRef(renderLogin);
  renderLoginRef.current = renderLogin;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const cyclesRef = useRef(0);
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

  // End on the wordmark, or cross-fade to `renderLogin` when one is given.
  const finish = useCallback(() => {
    if (!mounted.current) return;
    if (renderLoginRef.current) runExit();
    else onDoneRef.current?.();
  }, [runExit]);

  // Shapes swing back together and tilt, then hard-cut to the wordmark.
  const runReveal = useCallback(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(split, { toValue: 0, duration: MERGE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 1, duration: MERGE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(MERGED_HOLD_MS),
    ]).start(({ finished }) => {
      if (!finished || !mounted.current) return;
      setPhase('wordmark');
      if (hapticsRef.current) {
        // A failed vibration (unsupported device, haptics turned off) is not worth surfacing.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      Animated.timing(shine, {
        toValue: 1,
        duration: SHINE_MS,
        delay: SHINE_DELAY_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
      later(finish, WORDMARK_HOLD_MS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, tilt, shine, finish]);

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
        }
        if (next % PASS.length === 0) {
          cyclesRef.current += 1;
          if (readyRef.current && cyclesRef.current >= minCycles) {
            runReveal();
            return;
          }
        }
        runStep(next);
      });
    },
    [step, minCycles, runReveal],
  );

  // Merged shape -> tilt -> split and level -> conveyor.
  const runIntro = useCallback(() => {
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
  }, [tilt, split, runStep]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          // Show the wordmark still and finish as soon as the app is ready.
          setPhase('wordmark');
          if (readyRef.current) finish();
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
      shine.stopAnimation();
      exit.stopAnimation();
    };
    // Run once on mount; later prop changes are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && waitingForReadyRef.current) {
      waitingForReadyRef.current = false;
      finish();
    }
  }, [ready, finish]);

  const shapeStyles = useMemo(
    () =>
      SHAPES.map((_, n) => {
        const table = slotTable(n);
        const x = step.interpolate({
          inputRange: table.inputRange,
          outputRange: table.x.map((v) => v * pitch),
        });
        const scale = step.interpolate({ inputRange: table.inputRange, outputRange: table.scale });
        return {
          opacity: scale,
          // Merged, the two visible shapes overlap; split, they sit in their slots.
          transform: [
            { translateX: Animated.multiply(x, split.interpolate({ inputRange: [0, 1], outputRange: [MERGED_OFFSET, 1] })) },
            { scale },
          ],
        };
      }),
    [step, split, pitch],
  );

  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `-${TILT_DEG}deg`] });

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
          {phase === 'loader' ? (
            <Animated.View style={[styles.conveyor, { height: shapeSize, transform: [{ rotate }] }]}>
              {SHAPES.map(({ kind, color }, n) => (
                <Animated.View
                  key={n}
                  style={[
                    styles.slot,
                    { width: shapeSize, marginLeft: -shapeSize / 2, height: shapeSize },
                    shapeStyles[n],
                  ]}
                >
                  <Shape kind={kind} color={color} size={shapeSize} />
                </Animated.View>
              ))}
            </Animated.View>
          ) : (
            <Wordmark size={size} shine={shine} />
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
});

export default LaunchAnimation;
