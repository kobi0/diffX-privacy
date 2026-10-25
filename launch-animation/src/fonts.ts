/**
 * Orbitron (SIL Open Font License, see fonts/OFL.txt), bundled with the
 * component and loaded with expo-font by LaunchAnimation.
 */
export const FONTS = {
  wordmark: 'Orbitron-Black',
  tagline: 'Orbitron-Medium',
};

export const FONT_FILES = {
  [FONTS.wordmark]: require('./fonts/Orbitron-Black.ttf'),
  [FONTS.tagline]: require('./fonts/Orbitron-Medium.ttf'),
};

/** Orbitron's vertical metrics in em; the same for every weight. */
export const ORBITRON = { ascent: 1.011, descent: 0.243, capHeight: 0.72 };
