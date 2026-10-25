import React from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { FONTS, ORBITRON } from './fonts';

/**
 * The tagline, set in Orbitron Medium with wide letter spacing. Its words rise
 * into view from the bottom up, one after another from left to right, the same
 * way the wordmark's letters do.
 */

const LINE_HEIGHT = ORBITRON.ascent + ORBITRON.descent;
const LETTER_SPACING_EM = 0.2;
const WORD_GAP_EM = 0.55;
/** Share of the reveal that one word's own rise takes; the rest is stagger. */
const WORD_SPAN = 0.55;
const COLOR = '#ECEEF1';

export function Tagline({
  text,
  size,
  reveal,
  onWidth,
}: {
  text: string;
  size: number;
  /** 0..1: the words rise into view. */
  reveal: Animated.Value;
  /** Reports the tagline's laid-out width. */
  onWidth?: (width: number) => void;
}) {
  const words = text.split(' ');
  const height = LINE_HEIGHT * size;
  return (
    <View style={styles.row} onLayout={(e: LayoutChangeEvent) => onWidth?.(e.nativeEvent.layout.width)}>
      {words.map((word, i) => {
        const start = words.length > 1 ? (i * (1 - WORD_SPAN)) / (words.length - 1) : 0;
        const r = reveal.interpolate({
          inputRange: [start, start + WORD_SPAN],
          outputRange: [0, 1],
          easing: Easing.out(Easing.cubic),
          extrapolate: 'clamp',
        });
        return (
          // Reveal mask: slides up into place while the word inside counter-moves.
          <Animated.View
            key={i}
            style={[
              styles.mask,
              {
                height,
                marginRight: i < words.length - 1 ? WORD_GAP_EM * size : 0,
                transform: [{ translateY: r.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ translateY: r.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] }) }] }}>
              <Text
                style={[
                  styles.text,
                  {
                    fontFamily: FONTS.tagline,
                    fontSize: size,
                    lineHeight: height,
                    letterSpacing: LETTER_SPACING_EM * size,
                  },
                ]}
              >
                {word}
              </Text>
            </Animated.View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  mask: { overflow: 'hidden' },
  text: { color: COLOR, includeFontPadding: false },
});
