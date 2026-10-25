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
 *   shine      a soft bright band that sweeps across the word once
 *
 * The icon's three green speed lines sit in front of the "W", with their own
 * extruded edge.
 *
 * Kinetic reveal, modelled on a kinetic-type "CLAUDE" title card:
 *
 *   rise     letters are uncovered from the bottom up by a rising mask, one
 *            after another from left to right
 *   stretch  a wave runs left to right in which each letter goes from wide
 *            and short to tall and narrow, growing up from its baseline, while
 *            the letters slide together so the word stays tightly set
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
  { widthEm: 1.0, opacity: 0.22 },
  { widthEm: 0.35, opacity: 0.6 },
];

/** Letter proportions before and after the stretch wave (wide and short -> tall and narrow). */
const WIDE = { x: 1.0, y: 0.88 };
const TALL = { x: 0.8, y: 1.38 };
// Share of each 0..1 phase that one letter's own animation takes; the rest is
// stagger. A large share means neighbouring letters overlap, so the wave reads
// as one smooth motion rather than letters popping in turn.
const RISE_LETTER_SPAN = 0.5;
const STRETCH_LETTER_SPAN = 0.6;
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
 * A band-shaped window slides across the word while the bright copy of the
 * letter inside it counter-moves, so the copy stays aligned with the letter.
 * The band is upright: a tilted band would not stay aligned inside a letter
 * that is scaled differently across and down.
 * `centre` is the word's centre in the letter's own coordinates, so every
 * letter's band lines up into one band across the word.
 */
function ShineBand({
  shine,
  shineX,
  bandWidth,
  peakOpacity,
  centre,
  scale,
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
  /** The letter's horizontal scale; the band is drawn inside it, so undo it. */
  scale: number;
  size: number;
  char: string;
  color: string;
  text: TextStyle[];
}) {
  const width = bandWidth / scale;
  const left = centre - width / 2;
  const x = Animated.multiply(shineX, 1 / scale);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -size * 0.4,
        height: size * 2,
        left,
        width,
        overflow: 'hidden',
        opacity: shine.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, peakOpacity, peakOpacity, 0] }),
        transform: [{ translateX: x }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: size * 0.4,
          left: -left,
          transform: [{ translateX: Animated.multiply(x, -1) }],
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
  const [letterW, setLetterW] = useState<number[]>([]);

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
  const measured =
    wordWidth > 0 &&
    letterX.filter((x) => x != null).length === LETTERS.length &&
    letterW.filter((w) => w != null).length === LETTERS.length;

  const letterMotion = useMemo(() => {
    const progress = LETTERS.map((_, i) => staggered(stretchValue, i, STRETCH_LETTER_SPAN, Easing.inOut(Easing.cubic)));
    // How much each letter's width differs from its natural width.
    const widthDelta = progress.map((p, j) =>
      p.interpolate({ inputRange: [0, 1], outputRange: [(letterW[j] ?? 0) * (WIDE.x - 1), (letterW[j] ?? 0) * (TALL.x - 1)] }),
    );
    const sum = (nodes: Animated.AnimatedInterpolation<number>[]) =>
      nodes.reduce<Animated.AnimatedNode>((acc, n) => Animated.add(acc, n), new Animated.Value(0)) as Animated.AnimatedAddition<number>;
    const half = (n: Animated.AnimatedNode) => Animated.multiply(n as Animated.AnimatedAddition<number>, 0.5);
    const total = sum(widthDelta);
    return LETTERS.map((_, i) => {
      const r = staggered(riseValue, i, RISE_LETTER_SPAN, Easing.out(Easing.cubic));
      const s = progress[i];
      // Keep the letters packed as they change width, and the word centred:
      // shift by the width change of every letter to the left, plus half of this
      // letter's own (it scales about its centre), minus half of the total.
      const packX = measured
        ? Animated.add(Animated.add(sum(widthDelta.slice(0, i)), half(widthDelta[i])), Animated.multiply(half(total), -1))
        : 0;
      return {
        maskY: r.interpolate({ inputRange: [0, 1], outputRange: [clipHeight, 0] }),
        contentY: r.interpolate({ inputRange: [0, 1], outputRange: [-clipHeight, 0] }),
        scaleX: s.interpolate({ inputRange: [0, 1], outputRange: [WIDE.x, TALL.x] }),
        scaleY: s.interpolate({ inputRange: [0, 1], outputRange: [WIDE.y, TALL.y] }),
        packX,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riseValue, stretchValue, clipHeight, measured, letterW.join(',')]);

  // Letters grow upwards from the baseline, so keep the word centred vertically.
  const recentre = stretchValue.interpolate({
    inputRange: [0, 1],
    outputRange: [(CAP_HEIGHT * size * (WIDE.y - 1)) / 2, (CAP_HEIGHT * size * (TALL.y - 1)) / 2],
  });

  // Where each letter ends up once stretched, for lining up the shine across letters.
  const finalShift = (() => {
    if (!measured) return [];
    const d = letterW.map((w) => w * (TALL.x - 1));
    const total = d.reduce((a, b) => a + b, 0);
    return d.map((di, i) => d.slice(0, i).reduce((a, b) => a + b, 0) + di / 2 - total / 2);
  })();

  const travel = wordWidth / 2 + Math.max(...SHINE_BANDS.map((b) => b.widthEm)) * size * 2;
  const shineX = shine?.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });

  return (
    <Animated.View
      style={[styles.row, { transform: [{ translateY: recentre }] }]}
      onLayout={(e) => setWordWidth(e.nativeEvent.layout.width)}
    >
      {LETTERS.map(({ char, palette }, i) => {
        const motion = letterMotion[i];
        return (
          <Animated.View
            key={i}
            style={{
              marginRight: i < LETTERS.length - 1 ? LETTER_SPACING_EM * size : 0,
              transform: [{ translateX: motion.packX }],
            }}
            onLayout={(e) => {
              const { x, width: w } = e.nativeEvent.layout;
              setLetterX((prev) => Object.assign([...prev], { [i]: x }));
              setLetterW((prev) => Object.assign([...prev], { [i]: w }));
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
                    { scaleX: motion.scaleX },
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
                      // The word's centre in this letter's own (stretched) coordinates.
                      centre={letterW[i] / 2 + (wordWidth / 2 - letterX[i] - finalShift[i] - letterW[i] / 2) / TALL.x}
                      scale={TALL.x}
                      size={size}
                      char={char}
                      color={palette.shine}
                      text={text}
                    />
                  ))}
              </Animated.View>
            </Animated.View>
          </Animated.View>
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
