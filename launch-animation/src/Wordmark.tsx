import React, { useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { FONTS, ORBITRON } from './fonts';

/**
 * The "WAKA100" wordmark, set in Orbitron Black. Each letter is its own stack of text copies, so it
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
 *   stretch  the whole word grows taller while a width wave rolls through it
 *            from left to right: letters swell and squeeze in turn, trading
 *            width with each other so the word's overall width never changes.
 *            The wave dies out and the letters settle back to even widths.
 *   collapse each letter shrinks into a dot, one after another from left to
 *            right, and the dots glide into an evenly spaced row (`travel`),
 *            ready to turn into the tagline.
 */

// Orbitron's weight is chosen by family name, so no fontWeight on top.
const FONT_FAMILY = FONTS.wordmark;

// The line box is exactly ascent + descent, so the baseline sits at the ascent
// on every platform.
const LINE_HEIGHT = ORBITRON.ascent + ORBITRON.descent;
const CAP_HEIGHT = ORBITRON.capHeight;
const BASELINE = ORBITRON.ascent;
const CAP_TOP = BASELINE - CAP_HEIGHT;

const PALETTE = {
  waka: { highlight: '#FFFFFF', face: '#D3D6DC', sides: ['#8E9198', '#4A4C52'], shine: '#FFFFFF' },
  hundred: { highlight: '#B6F25E', face: '#7DD31E', sides: ['#4C9A08', '#21470A'], shine: '#EFFFD6' },
  glow: 'rgba(143, 220, 34, 0.55)',
  speedLines: '#8FDC22',
  speedLinesSide: '#2F6A05',
};

const LETTERS = 'WAKA100'.split('').map((char, i) => ({ char, palette: i < 4 ? PALETTE.waka : PALETTE.hundred }));

/** Extrusion depth and number of copies used to draw it. */
const DEPTH_EM = 0.075;
const DEPTH_STEPS = 7;
// A narrow bright band inside a wider faint one reads as a soft-edged reflection.
const SHINE_BANDS = [
  { widthEm: 1.0, opacity: 0.22 },
  { widthEm: 0.35, opacity: 0.6 },
];

/** How much taller the word ends up. */
const TALL_Y = 1.6;
/** Peak width change of a letter in the wave (0.45 = from 55% to 145% of its width). */
const WAVE_AMPLITUDE = 0.45;
/** How many times the swell travels across the word. */
const WAVE_CYCLES = 1.5;
/** Samples per letter used to describe the wave to the native animation driver. */
const WAVE_SAMPLES = 72;
// Share of each 0..1 phase that one letter's own animation takes; the rest is
// stagger.
const RISE_LETTER_SPAN = 0.5;
const COLLAPSE_LETTER_SPAN = 0.45;
/** Diameter of the dot each letter collapses into. */
const DOT_EM = 0.16;
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
  { y: 72, from: -15, to: 37 },
  { y: 83, from: -49, to: 41 },
  { y: 94, from: -19, to: 45 },
];
const SPEED_LINE_THICKNESS = 7.5;
const SPEED_LINES_LEFT = -60;
const SPEED_LINES_WIDTH = 110;

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

/**
 * The width wave, sampled over the 0..1 stretch phase. A swell travels left to
 * right through the letters; each letter's width follows a sine wave offset by
 * its position. Every sample is rescaled so the letters' widths add up to the
 * word's natural width: letters trade width and the word never grows or
 * shrinks. Returns each letter's horizontal scale and the sideways shift that
 * keeps the letters packed against each other.
 */
function widthWave(widths: number[]) {
  const n = widths.length;
  const natural = widths.reduce((a, b) => a + b, 0);
  const t: number[] = [];
  const scaleX: number[][] = widths.map(() => []);
  const shift: number[][] = widths.map(() => []);
  for (let k = 0; k <= WAVE_SAMPLES; k++) {
    const u = k / WAVE_SAMPLES;
    // Fade the wave in and out so the letters start and finish at even widths.
    const envelope = Math.sin(Math.PI * u) ** 0.6;
    const raw = widths.map((_, j) => 1 + WAVE_AMPLITUDE * envelope * Math.sin(2 * Math.PI * (WAVE_CYCLES * u - j / n)));
    const fit = natural / widths.reduce((sum, w, j) => sum + w * raw[j], 0);
    const sx = raw.map((v) => v * fit);
    // Each letter scales about its centre: move it by the width change of every
    // letter to its left plus half of its own.
    let left = 0;
    for (let j = 0; j < n; j++) {
      const delta = widths[j] * (sx[j] - 1);
      scaleX[j].push(sx[j]);
      shift[j].push(left + delta / 2);
      left += delta;
    }
    t.push(u);
  }
  return { t, scaleX, shift };
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
  /** 0..1: letters collapse into dots, left to right. Omit to keep the letters. */
  collapse?: Animated.Value;
  /** 0..1: the dots glide into an evenly spaced row `dotsSpan` wide. */
  travel?: Animated.Value;
  /** 0..1: the dots shrink away (as the tagline replaces them). */
  dotsOut?: Animated.Value;
  /** Width of the row the dots spread across. Defaults to 80% of the word. */
  dotsSpan?: number;
};

export function Wordmark({ size, rise, stretch, shine, collapse, travel, dotsOut, dotsSpan }: WordmarkProps) {
  const [wordWidth, setWordWidth] = useState(0);
  const [letterX, setLetterX] = useState<number[]>([]);
  const [letterW, setLetterW] = useState<number[]>([]);

  const riseValue = useMemo(() => rise ?? new Animated.Value(1), [rise]);
  const stretchValue = useMemo(() => stretch ?? new Animated.Value(1), [stretch]);
  const collapseValue = useMemo(() => collapse ?? new Animated.Value(0), [collapse]);
  const travelValue = useMemo(() => travel ?? new Animated.Value(0), [travel]);
  const dotsOutValue = useMemo(() => dotsOut ?? new Animated.Value(0), [dotsOut]);

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
    const wave = widthWave(LETTERS.map((_, j) => (measured ? letterW[j] : 1)));
    return LETTERS.map((_, i) => {
      const r = staggered(riseValue, i, RISE_LETTER_SPAN, Easing.out(Easing.cubic));
      const c = staggered(collapseValue, i, COLLAPSE_LETTER_SPAN, Easing.in(Easing.cubic));
      return {
        letterScale: c.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        // The dot grows in as the letter shrinks into it, and shrinks away at the end.
        dotScale: Animated.multiply(
          c.interpolate({ inputRange: [0.55, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          dotsOutValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        ),
        maskY: r.interpolate({ inputRange: [0, 1], outputRange: [clipHeight, 0] }),
        contentY: r.interpolate({ inputRange: [0, 1], outputRange: [-clipHeight, 0] }),
        scaleX: stretchValue.interpolate({ inputRange: wave.t, outputRange: wave.scaleX[i] }),
        scaleY: stretchValue.interpolate({ inputRange: [0, 1], outputRange: [1, TALL_Y], easing: Easing.inOut(Easing.sin) }),
        packX: measured ? stretchValue.interpolate({ inputRange: wave.t, outputRange: wave.shift[i] }) : 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riseValue, stretchValue, collapseValue, dotsOutValue, clipHeight, measured, letterW.join(',')]);

  // Letters grow upwards from the baseline, so keep the word centred vertically.
  const recentre = stretchValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (CAP_HEIGHT * size * (TALL_Y - 1)) / 2],
    easing: Easing.inOut(Easing.sin),
  });

  const shineTravel = wordWidth / 2 + Math.max(...SHINE_BANDS.map((b) => b.widthEm)) * size * 2;
  const shineX = shine?.interpolate({ inputRange: [0, 1], outputRange: [-shineTravel, shineTravel] });

  // A collapsing letter shrinks towards the middle of its stretched shape.
  const middle = (BASELINE - (CAP_HEIGHT * TALL_Y) / 2) * size;
  const toMiddle = middle - (LINE_HEIGHT * size) / 2;
  const dot = DOT_EM * size;
  const span = dotsSpan ?? wordWidth * 0.8;

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
              transform: [
                { translateX: motion.packX },
                { translateY: toMiddle },
                { scale: motion.letterScale },
                { translateY: -toMiddle },
              ],
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
                      // The word's centre in this letter's own coordinates (the wave
                      // has settled by the time the shine runs).
                      centre={wordWidth / 2 - letterX[i]}
                      scale={1}
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

      {/* Dots: one per letter, at the letter's centre, gliding into an even row. */}
      {measured &&
        LETTERS.map(({ palette }, i) => {
          const from = letterX[i] + letterW[i] / 2;
          const to = wordWidth / 2 - span / 2 + (span * i) / (LETTERS.length - 1);
          return (
            <Animated.View
              key={`dot${i}`}
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  left: from - dot / 2,
                  top: middle - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: palette.face,
                  transform: [
                    { translateX: travelValue.interpolate({ inputRange: [0, 1], outputRange: [0, to - from] }) },
                    { scale: letterMotion[i].dotScale },
                  ],
                },
              ]}
            />
          );
        })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  text: { includeFontPadding: false, textAlign: 'center' },
  ghost: { opacity: 0 },
  mask: { position: 'absolute', overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, left: 0 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  dot: { position: 'absolute' },
});
