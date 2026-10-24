import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';

/**
 * The Waka100 logo, traced from the 512×512 app icon. Every piece is drawn in
 * the same 512 viewBox so the layers can be stacked on top of each other and
 * animated independently while staying pixel-aligned with the icon.
 */
export const VIEWBOX = 512;

export const COLORS = {
  screen: '#050607',
  tileTop: '#2A2B2F',
  tileBottom: '#141518',
  greenLight: '#B2EE62',
  greenMid: '#7FD323',
  greenDark: '#4EB105',
  greenShadeTop: '#6CBF26',
  greenShadeBottom: '#3E9A05',
  textGreenTop: '#9BE52C',
  textGreenBottom: '#6BC313',
  white: '#FFFFFF',
  whiteShade: '#E6E7EA',
  overlapGap: '#1E1F22',
};

const WORDMARK_FONT = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif',
  default: 'Helvetica, Arial, sans-serif',
});

export type LogoPart =
  | 'tile'
  | 'speedLines'
  | 'strokeBack' // the "/" of the W that passes behind
  | 'strokeLeft' // first "\" of the W
  | 'strokeFront' // second "\" of the W, drawn over the back stroke
  | 'ringRight'
  | 'ringLeft'
  | 'wordmark';

const GreenGradients = () => (
  <Defs>
    <LinearGradient id="wk-green" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="268">
      <Stop offset="0" stopColor={COLORS.greenLight} />
      <Stop offset="0.55" stopColor={COLORS.greenMid} />
      <Stop offset="1" stopColor={COLORS.greenDark} />
    </LinearGradient>
    <LinearGradient id="wk-green-shade" gradientUnits="userSpaceOnUse" x1="0" y1="130" x2="0" y2="268">
      <Stop offset="0" stopColor={COLORS.greenShadeTop} />
      <Stop offset="1" stopColor={COLORS.greenShadeBottom} />
    </LinearGradient>
  </Defs>
);

function PartShapes({ part }: { part: LogoPart }) {
  switch (part) {
    case 'tile':
      return (
        <>
          <Defs>
            <LinearGradient id="wk-tile" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.tileTop} />
              <Stop offset="1" stopColor={COLORS.tileBottom} />
            </LinearGradient>
          </Defs>
          <Rect x="21" y="11" width="470" height="485" rx="86" fill="url(#wk-tile)" />
        </>
      );
    case 'speedLines':
      return (
        <>
          <Polygon points="146,232 168,229 168,235 140,236" fill={COLORS.greenMid} />
          <Polygon points="104,244 172,240 172,247 104,246" fill={COLORS.greenMid} />
          <Polygon points="138,262 176,255 176,262 138,264" fill={COLORS.greenMid} />
        </>
      );
    case 'strokeBack':
      return (
        <>
          <GreenGradients />
          <Polygon points="190,264 222,264 302,133 270,133" fill="url(#wk-green-shade)" />
        </>
      );
    case 'strokeLeft':
      return (
        <>
          <GreenGradients />
          <Polygon points="109,133 150,133 226,264 185,264" fill="url(#wk-green)" />
        </>
      );
    case 'strokeFront':
      return (
        <>
          <GreenGradients />
          {/* A dark outline under the fill gives the folded-ribbon gap where it crosses the back stroke. */}
          <Polygon
            points="181,133 216,133 292,267 257,267"
            fill="none"
            stroke={COLORS.overlapGap}
            strokeWidth={6}
            strokeLinejoin="miter"
          />
          <Polygon points="181,133 216,133 292,267 257,267" fill="url(#wk-green)" />
        </>
      );
    case 'ringRight':
      return (
        <>
          <GreenGradients />
          <Ellipse cx="395" cy="208" rx="37" ry="47" fill="none" stroke="url(#wk-green)" strokeWidth={20} />
        </>
      );
    case 'ringLeft':
      return (
        <>
          <GreenGradients />
          <Ellipse cx="333" cy="208" rx="40" ry="48" fill="none" stroke="url(#wk-green)" strokeWidth={21} />
        </>
      );
    case 'wordmark':
      return (
        <>
          <Defs>
            <LinearGradient id="wk-text-white" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.white} />
              <Stop offset="1" stopColor={COLORS.whiteShade} />
            </LinearGradient>
            <LinearGradient id="wk-text-green" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLORS.textGreenTop} />
              <Stop offset="1" stopColor={COLORS.textGreenBottom} />
            </LinearGradient>
          </Defs>
          <SvgText
            x="257"
            y="356"
            textAnchor="middle"
            fontFamily={WORDMARK_FONT}
            fontSize="88"
            fontWeight="700"
            letterSpacing={-2}
          >
            <TSpan fill="url(#wk-text-white)">Waka</TSpan>
            <TSpan fill="url(#wk-text-green)">100</TSpan>
          </SvgText>
        </>
      );
  }
}

/** One layer of the logo, filling its parent. */
export function LogoLayer({ part }: { part: LogoPart }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      pointerEvents="none"
    >
      <PartShapes part={part} />
    </Svg>
  );
}

/** The full static logo, identical to the app icon. */
export function WakaLogo({ size = 256, showTile = true }: { size?: number; showTile?: boolean }) {
  const parts: LogoPart[] = [
    'speedLines',
    'strokeBack',
    'strokeLeft',
    'strokeFront',
    'ringRight',
    'ringLeft',
    'wordmark',
  ];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      {showTile && <PartShapes part="tile" />}
      {parts.map((p) => (
        <PartShapes key={p} part={p} />
      ))}
    </Svg>
  );
}
