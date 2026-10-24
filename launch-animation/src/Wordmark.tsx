import React, { useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

/**
 * The "Waka100" wordmark, built from stacked copies of the same text so it
 * looks solid without any image assets or extra dependencies:
 *
 *   glow       soft green halo behind everything
 *   extrusion  darker copies stepped down and right, giving the letters depth
 *   face       the letters themselves, a shade darker at the bottom
 *   highlight  the top half of the face in a lighter colour (a lit bevel)
 *   shine      a bright diagonal strip that sweeps across once, driven by `shine`
 *
 * The icon's three green speed lines sit in front of the "W", with their own
 * extruded edge.
 */

// iOS and Android use the system font (SF Pro / Roboto) at its heaviest weight.
export const FONT_FAMILY = Platform.select({
  ios: undefined,
  android: 'sans-serif',
  default: 'Inter, "Helvetica Neue", Arial, sans-serif',
});
export const FONT_WEIGHT = '900';

// Glyph metrics shared by SF Pro, Roboto and Inter, in em, for a line height of 1.2em.
const CAP_TOP = 0.24;
const CAP_HEIGHT = 0.715;

const PALETTE = {
  waka: { highlight: '#FFFFFF', face: '#D3D6DC', sides: ['#8E9198', '#4A4C52'], shine: '#FFFFFF' },
  hundred: { highlight: '#B6F25E', face: '#7DD31E', sides: ['#4C9A08', '#21470A'], shine: '#EFFFD6' },
  glow: 'rgba(143, 220, 34, 0.55)',
  speedLines: '#8FDC22',
  speedLinesSide: '#2F6A05',
};

/** Extrusion depth and number of copies used to draw it. */
const DEPTH_EM = 0.075;
const DEPTH_STEPS = 7;
// A narrow bright band inside a wider faint one reads as a soft-edged reflection.
const SHINE_BANDS = [
  { widthEm: 0.8, opacity: 0.35 },
  { widthEm: 0.28, opacity: 0.9 },
];
const SHINE_ANGLE_DEG = 18;

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
function SpeedLines({ fontSize, color, dx = 0, dy = 0 }: { fontSize: number; color: string; dx?: number; dy?: number }) {
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
        left: (SPEED_LINES_LEFT / 100) * cap + dx,
        top: CAP_TOP * fontSize + dy,
      }}
    >
      {SPEED_LINES.map(({ y, from, to }) => (
        <Polygon
          key={y}
          points={`${from},${y - t * 0.1} ${to},${y - t / 2} ${to},${y + t / 2} ${from},${y + t * 0.2}`}
          fill={color}
        />
      ))}
    </Svg>
  );
}

function Letters({ waka, hundred, style }: { waka: string; hundred: string; style: TextStyle | TextStyle[] }) {
  return (
    <Text style={style} accessible={false}>
      <Text style={{ color: waka }}>Waka</Text>
      <Text style={{ color: hundred }}>100</Text>
    </Text>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A tilted band-shaped window slides across the wordmark while the bright copy
 * of the text inside it counter-moves, so the copy stays aligned with the letters.
 */
function ShineBand({
  shine,
  shineX,
  bandWidth,
  peakOpacity,
  wordmarkWidth,
  size,
  text,
}: {
  shine: Animated.Value;
  shineX: Animated.AnimatedInterpolation<number>;
  bandWidth: number;
  peakOpacity: number;
  wordmarkWidth: number;
  size: number;
  text: TextStyle[];
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -size * 0.4,
        height: size * 2,
        left: (wordmarkWidth - bandWidth) / 2,
        width: bandWidth,
        overflow: 'hidden',
        opacity: shine.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, peakOpacity, peakOpacity, 0] }),
        transform: [{ translateX: shineX }, { rotate: `${SHINE_ANGLE_DEG}deg` }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: size * 0.4,
          left: -(wordmarkWidth - bandWidth) / 2,
          width: wordmarkWidth,
          transform: [{ rotate: `${-SHINE_ANGLE_DEG}deg` }, { translateX: Animated.multiply(shineX, -1) }],
        }}
      >
        <Letters waka={PALETTE.waka.shine} hundred={PALETTE.hundred.shine} style={text} />
      </Animated.View>
    </Animated.View>
  );
}

export function Wordmark({ size, shine }: { size: number; shine?: Animated.Value }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const text: TextStyle[] = [
    styles.text,
    { fontSize: size, lineHeight: size * 1.2, fontFamily: FONT_FAMILY },
  ];
  const layer = StyleSheet.absoluteFill;
  const depth = DEPTH_EM * size;

  // Deepest copy first so nearer ones paint over it.
  const steps = Array.from({ length: DEPTH_STEPS }, (_, i) => DEPTH_STEPS - i);

  const travel = width / 2 + Math.max(...SHINE_BANDS.map((b) => b.widthEm)) * size * 2;
  const shineX = shine?.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });

  return (
    <View>
      {/* Glow */}
      <View style={layer} pointerEvents="none">
        <Letters
          waka={PALETTE.waka.face}
          hundred={PALETTE.hundred.face}
          style={[...text, { textShadowColor: PALETTE.glow, textShadowRadius: size * 0.35, textShadowOffset: { width: 0, height: 0 } }]}
        />
      </View>

      {/* Extrusion */}
      {steps.map((i) => {
        const t = i / DEPTH_STEPS;
        const off = depth * t;
        return (
          <View key={i} style={[layer, { transform: [{ translateX: off * 0.5 }, { translateY: off }] }]} pointerEvents="none">
            <SpeedLines fontSize={size} color={PALETTE.speedLinesSide} />
            <Letters
              waka={mix(PALETTE.waka.sides[0], PALETTE.waka.sides[1], t)}
              hundred={mix(PALETTE.hundred.sides[0], PALETTE.hundred.sides[1], t)}
              style={text}
            />
          </View>
        );
      })}

      {/* Face: this copy is in the layout flow and sizes the wordmark */}
      <View onLayout={onLayout}>
        <SpeedLines fontSize={size} color={PALETTE.speedLines} />
        <Letters waka={PALETTE.waka.face} hundred={PALETTE.hundred.face} style={text} />
      </View>

      {/* Highlight: the top half of each letter, lit from above */}
      <View style={[styles.top, { height: (CAP_TOP + CAP_HEIGHT * 0.5) * size }]} pointerEvents="none">
        <Letters waka={PALETTE.waka.highlight} hundred={PALETTE.hundred.highlight} style={text} />
      </View>

      {/* Shine */}
      {shine && shineX && width > 0 &&
        SHINE_BANDS.map(({ widthEm, opacity }) => (
          <ShineBand
            key={widthEm}
            shine={shine}
            shineX={shineX}
            bandWidth={widthEm * size}
            peakOpacity={opacity}
            wordmarkWidth={width}
            size={size}
            text={text}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontWeight: FONT_WEIGHT, includeFontPadding: false, textAlign: 'center', letterSpacing: -1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
