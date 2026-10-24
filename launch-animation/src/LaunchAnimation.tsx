import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { COLORS, LogoLayer, LogoPart, VIEWBOX } from './WakaLogo';

/** Length of one loader cycle in ms. */
export const CYCLE_MS = 1800;

// Points on the 0..1 cycle timeline.
const ASSEMBLED = 0.8; // every piece is in place
const DISPERSE = 0.86; // pieces start dashing off to the right
const EXIT_MS = 520;

export type LaunchAnimationProps = {
  /** true once the app has finished starting up (fonts, auth check, ...). */
  ready: boolean;
  /** Shortest loader run, in full 1.8s cycles, before the outro may start. */
  minCycles?: number;
  /** Screen revealed underneath the logo when the animation hands off. */
  renderLogin?: () => React.ReactNode;
  /** Called once the hand-off transition has finished. */
  onDone?: () => void;
  /** Draw the rounded app-icon tile behind the mark (default true). */
  showTile?: boolean;
  /** Logo edge length in px. Defaults to 72% of the shorter screen side. */
  size?: number;
  backgroundColor?: string;
};

type Motion = {
  /** Cycle-timeline window in which the piece flies in. */
  inStart: number;
  inEnd: number;
  /** Offset (in 512-viewBox units) the piece flies in from. */
  fromX?: number;
  fromY?: number;
  /** Scale the piece grows from, around `origin`. */
  fromScale?: number;
  origin?: [number, number];
  easing?: (v: number) => number;
};

// Draw order is back to front, matching the icon.
const MOTIONS: Array<[LogoPart, Motion]> = [
  ['speedLines', { inStart: 0.3, inEnd: 0.56, fromX: -90 }],
  ['strokeBack', { inStart: 0.1, inEnd: 0.32, fromX: 40, fromY: -66 }],
  ['strokeLeft', { inStart: 0.0, inEnd: 0.22, fromX: -38, fromY: -66 }],
  ['strokeFront', { inStart: 0.2, inEnd: 0.42, fromX: -38, fromY: -66 }],
  [
    'ringRight',
    { inStart: 0.48, inEnd: 0.72, fromScale: 0.35, origin: [395, 208], easing: Easing.out(Easing.back(2)) },
  ],
  [
    'ringLeft',
    { inStart: 0.38, inEnd: 0.62, fromScale: 0.35, origin: [333, 208], easing: Easing.out(Easing.back(2)) },
  ],
];

function layerStyle(t: Animated.Value, m: Motion, k: number, isSpeedLines: boolean) {
  const easing = m.easing ?? Easing.out(Easing.cubic);
  const range = [0, m.inStart, m.inEnd, DISPERSE, 1];
  const opacity = t.interpolate({
    inputRange: range,
    outputRange: [0, 0, 1, 1, 0],
    easing,
    extrapolate: 'clamp',
  });
  // Speed lines trail behind (drift left) while the mark dashes off to the right.
  const exitX = (isSpeedLines ? -30 : 50) * k;
  const translateX = t.interpolate({
    inputRange: range,
    outputRange: [(m.fromX ?? 0) * k, (m.fromX ?? 0) * k, 0, 0, exitX],
    easing,
    extrapolate: 'clamp',
  });
  const translateY = t.interpolate({
    inputRange: range,
    outputRange: [(m.fromY ?? 0) * k, (m.fromY ?? 0) * k, 0, 0, 0],
    easing,
    extrapolate: 'clamp',
  });
  const transform: any[] = [{ translateX }, { translateY }];
  if (m.fromScale != null && m.origin) {
    // RN scales around the view centre, so shift the origin there and back.
    const ox = (m.origin[0] - VIEWBOX / 2) * k;
    const oy = (m.origin[1] - VIEWBOX / 2) * k;
    const scale = t.interpolate({
      inputRange: range,
      outputRange: [m.fromScale, m.fromScale, 1, 1, 1],
      easing,
      extrapolate: 'clamp',
    });
    transform.push({ translateX: ox }, { translateY: oy }, { scale }, { translateX: -ox }, { translateY: -oy });
  }
  return { opacity, transform };
}

export function LaunchAnimation({
  ready,
  minCycles = 2,
  renderLogin,
  onDone,
  showTile = true,
  size,
  backgroundColor = COLORS.screen,
}: LaunchAnimationProps) {
  const { width, height } = useWindowDimensions();
  const logoSize = size ?? Math.min(Math.min(width, height) * 0.72, 380);
  const k = logoSize / VIEWBOX;

  const t = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<'loading' | 'exiting' | 'done'>('loading');
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const cyclesRef = useRef(0);
  const reduceMotionRef = useRef<boolean | null>(null);
  const waitingForReadyRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const mounted = useRef(true);

  const runExit = useCallback(() => {
    if (!mounted.current) return;
    setPhase('exiting');
    Animated.timing(exit, {
      toValue: 1,
      duration: reduceMotionRef.current ? 200 : EXIT_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || !mounted.current) return;
      setPhase('done');
      onDoneRef.current?.();
    });
  }, [exit]);

  // Assemble the logo one last time and hold it, then hand off.
  const runOutro = useCallback(() => {
    t.setValue(0);
    Animated.parallel([
      Animated.timing(t, {
        toValue: ASSEMBLED,
        duration: ASSEMBLED * CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(wordmark, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setTimeout(runExit, 280);
    });
  }, [t, wordmark, runExit]);

  const runCycle = useCallback(() => {
    if (!mounted.current) return;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: CYCLE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      cyclesRef.current += 1;
      if (readyRef.current && cyclesRef.current >= minCycles) runOutro();
      else runCycle();
    });
  }, [t, minCycles, runOutro]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        reduceMotionRef.current = reduce;
        if (reduce) {
          // Static logo; hand off as soon as the app is ready.
          t.setValue(ASSEMBLED);
          wordmark.setValue(1);
          if (readyRef.current) runExit();
          else waitingForReadyRef.current = true;
          return;
        }
        Animated.timing(wordmark, {
          toValue: 1,
          duration: 500,
          delay: 0.5 * CYCLE_MS,
          useNativeDriver: true,
        }).start();
        runCycle();
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      t.stopAnimation();
      wordmark.stopAnimation();
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

  const layerStyles = useMemo(
    () => MOTIONS.map(([part, motion]) => layerStyle(t, motion, k, part === 'speedLines')),
    [t, k],
  );

  const logoExitStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
  };
  const loginStyle = {
    opacity: exit,
    transform: [{ translateY: exit.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };

  return (
    <View style={styles.fill}>
      {phase !== 'loading' && renderLogin && (
        <Animated.View style={[styles.fill, loginStyle]}>{renderLogin()}</Animated.View>
      )}
      {phase !== 'done' && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.center, { backgroundColor }, logoExitStyle]}
          pointerEvents={phase === 'exiting' ? 'none' : 'auto'}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Waka100 is loading"
        >
          <View style={{ width: logoSize, height: logoSize }}>
            {showTile && <LogoLayer part="tile" />}
            {MOTIONS.map(([part], i) => (
              <Animated.View key={part} style={[StyleSheet.absoluteFill, layerStyles[i]]}>
                <LogoLayer part={part} />
              </Animated.View>
            ))}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: wordmark,
                  transform: [
                    { translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [14 * k, 0] }) },
                  ],
                },
              ]}
            >
              <LogoLayer part="wordmark" />
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default LaunchAnimation;
