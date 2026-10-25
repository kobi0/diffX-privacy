import React, { useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

/**
 * The "Waka100" wordmark. Each letter is its own stack of text copies, so it
 * looks solid without any image assets or extra dependencies:
 *
 *   glow       soft green halo behind everything
 *   extrusion  darker copies stepped down and right, giving the letter depth
 *   face       the letter itself, a shade darker at the bottom
 *   highlight  the top half of the face in a lighter colour (a lit bevel)
 *   shine      a bright diagonal band that sweeps across the word once
 *
 * The icon's three green speed lines sit in front of the "W", with their own
 * extruded edge.
 *
 * Kinetic reveal, modelled on a kinetic-type "CLAUDE" title card:
 *
 *   rise     letters are uncovered from the bottom up by a rising mask, one
 *            after another from left to right
 *   stretch  a wave runs left to right in which each letter grows taller from
 *            its baseline, turning the word tall and condensed
 */

// iOS and Android use the system font (SF Pro / Roboto) at its heaviest weight.
export const FONT_FAMILY = Platform.select({
  ios: undefined,
  android: 'sans-serif',
  default: 'Inter, "Helvetica Neue", Arial, sans-serif',
});
export const FONT_WEIGHT = '900';

// Glyph metrics shared by SF Pro, Roboto and Inter, in em, for a line height of 1.2em.
const LINE_HEIGHT = 1.2;
const CAP_TOP = 0.24;
const CAP_HEIGHT = 0.715;
const BASELINE = CAP_TOP + CAP_HEIGHT;

const PALETTE = {
  waka: { highlight: '#FFFFFF', face: '#D3D6DC', sides: ['#8E9198', '#4A4C52'], shine: '#FFFFFF' },
  hundred: { highlight: '#B6F25E', face: '#7DD31E', sides: ['#4C9A08', '#21470A'], shine: '#EFFFD6' },
  glow: 'rgba(143, 220, 34, 0.55)',
  speedLines: '#8FDC22',
  speedLinesSide: '#2F6A05',
};

const LETTERS = 'Waka100'.split('').map((char, i) => ({ char, palette: i < 4 ? PALETTE.waka : PALETTE.hundred }));

/** Extrusion depth and number of copies used to draw it. */
const DEPTH_EM = 0.075;
const DEPTH_STEPS = 7;
// A narrow bright band inside a wider faint one reads as a soft-edged reflection.
const SHINE_BANDS = [
  { widthEm: 0.8, opacity: 0.35 },
  { widthEm: 0.28, opacity: 0.9 },
];
const SHINE_ANGLE_DEG = 18;

/** How much taller the letters end up after the stretch wave. */
export const STRETCH_Y = 1.45;
// Share of each 0..1 phase that one letter's own animation takes; the rest is stagger.
const RISE_LETTER_SPAN = 0.5;
const STRETCH_LETTER_SPAN = 0.45;
// Each letter's reveal mask, in em around its text box: room for the speed
// lines, glow and extrusion, and for the letter once stretched.
const CLIP = { top: 0.8, left: 1.0, right: 0.5, bottom: 0.3 };
const CLIP_HEIGHT = CLIP.top + LINE_HEIGHT + CLIP.bottom;
const LETTER_SPACING_EM = -0.02;

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
function SpeedLines({ fontSize, color }: { fontSize: number; color: string }) {
  const cap = CAP_HEIGHT * fontSize;
  const t = SPEED_LINE_THICKNESS;
  return (
    <Svg
      pointerEvents="none"
      width={(SPEED_LINES_WIDTH / 100) * cap}
      height={cap}
      viewBox={`${SPEED_LINES_LEFT} 0 ${SPEED_LINES_WIDTH} 100`}
      style={{ position: 'absolute', left: (SPEED_LINES_LEFT / 100) * cap, top: CAP_TOP * fontSize }}
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

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Letter `i`'s own 0..1 progress within a phase that staggers left to right. */
function staggered(value: Animated.Value, i: number, span: number, easing: (t: number) => number) {
  const start = (i * (1 - span)) / (LETTERS.length - 1);
  return value.interpolate({ inputRange: [start, start + span], outputRange: [0, 1], easing, extrapolate: 'clamp' });
}

/**
 * A tilted band-shaped window slides across the word while the bright copy of
 * the letter inside it counter-moves, so the copy stays aligned with the letter.
 * `centre` is the word's centre in the letter's own coordinates, so every
 * letter's band lines up into one band across the word.
 */
function ShineBand({
  shine,
  shineX,
  bandWidth,
  peakOpacity,
  centre,
  size,
  char,
  color,
  text,
}: {
  shine: Animated.Value;
  shineX: Animated.AnimatedInterpolation<number>;
  bandWidth: number;
  peakOpacity: number;
  centre: number;
  size: number;
  char: string;
  color: string;
  text: TextStyle[];
}) {
  const left = centre - bandWidth / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -size * 0.4,
        height: size * 2,
        left,
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
          left: -left,
          transform: [{ rotate: `${-SHINE_ANGLE_DEG}deg` }, { translateX: Animated.multiply(shineX, -1) }],
        }}
      >
        <Text style={[...text, { color }]}>{char}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export type WordmarkProps = {
  size: number;
  /** 0..1: letters rise into view. Omit to show them risen. */
  rise?: Animated.Value;
  /** 0..1: the stretch wave. Omit to show the word fully stretched. */
  stretch?: Animated.Value;
  /** 0..1: the shine sweep. Omit for no shine. */
  shine?: Animated.Value;
};

export function Wordmark({ size, rise, stretch, shine }: WordmarkProps) {
  const [wordWidth, setWordWidth] = useState(0);
  const [letterX, setLetterX] = useState<number[]>([]);

  const riseValue = useMemo(() => rise ?? new Animated.Value(1), [rise]);
  const stretchValue = useMemo(() => stretch ?? new Animated.Value(1), [stretch]);

  const text: TextStyle[] = [
    styles.text,
    { fontSize: size, lineHeight: size * LINE_HEIGHT, fontFamily: FONT_FAMILY },
  ];
  const depth = DEPTH_EM * size;
  // Deepest copy first so nearer ones paint over it.
  const steps = Array.from({ length: DEPTH_STEPS }, (_, i) => DEPTH_STEPS - i);

  const clipHeight = CLIP_HEIGHT * size;
  // Distance from the centre of a letter's text box down to its baseline.
  const toBaseline = (BASELINE - LINE_HEIGHT / 2) * size;

  const letterMotion = useMemo(
    () =>
      LETTERS.map((_, i) => {
        const r = staggered(riseValue, i, RISE_LETTER_SPAN, Easing.out(Easing.cubic));
        const s = staggered(stretchValue, i, STRETCH_LETTER_SPAN, Easing.inOut(Easing.cubic));
        return {
          maskY: r.interpolate({ inputRange: [0, 1], outputRange: [clipHeight, 0] }),
          contentY: r.interpolate({ inputRange: [0, 1], outputRange: [-clipHeight, 0] }),
          scaleY: s.interpolate({ inputRange: [0, 1], outputRange: [1, STRETCH_Y] }),
        };
      }),
    [riseValue, stretchValue, clipHeight],
  );

  // Letters grow upwards, so keep the word centred by easing it down as it stretches.
  const recentre = stretchValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (CAP_HEIGHT * size * (STRETCH_Y - 1)) / 2],
  });

  const travel = wordWidth / 2 + Math.max(...SHINE_BANDS.map((b) => b.widthEm)) * size * 2;
  const shineX = shine?.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  const measured = wordWidth > 0 && letterX.length === LETTERS.length;

  return (
    <Animated.View
      style={[styles.row, { transform: [{ translateY: recentre }] }]}
      onLayout={(e) => setWordWidth(e.nativeEvent.layout.width)}
    >
      {LETTERS.map(({ char, palette }, i) => {
        const motion = letterMotion[i];
        return (
          <View
            key={i}
            style={{ marginRight: i < LETTERS.length - 1 ? LETTER_SPACING_EM * size : 0 }}
            onLayout={(e) => {
              const x = e.nativeEvent.layout.x;
              setLetterX((prev) => {
                const next = [...prev];
                next[i] = x;
                return next;
              });
            }}
          >
            {/* Invisible copy that gives the letter its place in the row. */}
            <Text style={[...text, styles.ghost]}>{char}</Text>

            {/* Reveal mask: slides up into place while its content counter-moves. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.mask,
                {
                  top: -CLIP.top * size,
                  left: -CLIP.left * size,
                  right: -CLIP.right * size,
                  height: clipHeight,
                  transform: [{ translateY: motion.maskY }],
                },
              ]}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  top: CLIP.top * size,
                  left: CLIP.left * size,
                  transform: [
                    { translateY: motion.contentY },
                    // Stretch about the baseline.
                    { translateY: toBaseline },
                    { scaleY: motion.scaleY },
                    { translateY: -toBaseline },
                  ],
                }}
              >
                {/* Glow */}
                <Text
                  style={[
                    ...text,
                    styles.layer,
                    {
                      color: palette.face,
                      textShadowColor: PALETTE.glow,
                      textShadowRadius: size * 0.35,
                      textShadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                >
                  {char}
                </Text>

                {/* Extrusion */}
                {steps.map((step) => {
                  const t = step / DEPTH_STEPS;
                  const off = depth * t;
                  return (
                    <View key={step} style={[styles.layer, { transform: [{ translateX: off * 0.5 }, { translateY: off }] }]}>
                      {i === 0 && <SpeedLines fontSize={size} color={PALETTE.speedLinesSide} />}
                      <Text style={[...text, { color: mix(palette.sides[0], palette.sides[1], t) }]}>{char}</Text>
                    </View>
                  );
                })}

                {/* Face: in the layout flow, so it sizes this stack */}
                <View>
                  {i === 0 && <SpeedLines fontSize={size} color={PALETTE.speedLines} />}
                  <Text style={[...text, { color: palette.face }]}>{char}</Text>
                </View>

                {/* Highlight: the top half of the letter, lit from above */}
                <View style={[styles.top, { height: (CAP_TOP + CAP_HEIGHT * 0.5) * size }]}>
                  <Text style={[...text, { color: palette.highlight }]}>{char}</Text>
                </View>

                {/* Shine */}
                {shine && shineX && measured &&
                  SHINE_BANDS.map(({ widthEm, opacity }) => (
                    <ShineBand
                      key={widthEm}
                      shine={shine}
                      shineX={shineX}
                      bandWidth={widthEm * size}
                      peakOpacity={opacity}
                      centre={wordWidth / 2 - letterX[i]}
                      size={size}
                      char={char}
                      color={palette.shine}
                      text={text}
                    />
                  ))}
              </Animated.View>
            </Animated.View>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  text: { fontWeight: FONT_WEIGHT, includeFontPadding: false, textAlign: 'center' },
  ghost: { opacity: 0 },
  mask: { position: 'absolute', overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, left: 0 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
