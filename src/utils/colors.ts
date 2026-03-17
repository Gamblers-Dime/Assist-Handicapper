// CourtIQ Android Color System
// Primary: Light Tan / Warm Cream + Blue Highlights

export const Colors = {
  // ── Core Palette ─────────────────────────────────────────────
  tan:         '#F2E8D5',    // primary background
  tanLight:    '#FAF5EC',    // card surface / elevated
  tanMid:      '#E8D9C0',    // subtle dividers, secondary surfaces
  tanDeep:     '#D4C4A8',    // borders, lower contrast surfaces

  blue:        '#1B6CA8',    // primary action / highlight
  blueLight:   '#4A90C4',    // secondary highlights, charts
  bluePale:    '#D6E9F8',    // tinted backgrounds, badges
  blueDark:    '#0F4A7A',    // pressed states, headers
  blueVibrant: '#2980D9',    // chart lines, winning indicators

  // ── Text ──────────────────────────────────────────────────────
  textPrimary:   '#1A1208',  // near-black on tan
  textSecondary: '#5A4A32',  // muted on tan
  textTertiary:  '#8A7460',  // very muted
  textOnBlue:    '#FFFFFF',
  textOnTan:     '#1A1208',

  // ── Semantic ──────────────────────────────────────────────────
  win:    '#1B8A5A',   // deep green
  loss:   '#C0392B',   // red
  push:   '#7A6A52',   // neutral

  gradeA: '#1B6CA8',   // blue = strong
  gradeB: '#2FAE7A',   // teal = good
  gradeC: '#D4A017',   // amber = moderate
  gradeD: '#B0A090',   // grey = pass

  over:   '#1B6CA8',   // blue
  under:  '#2FAE7A',   // teal

  // ── Surface layers ────────────────────────────────────────────
  background:      '#F2E8D5',
  surface:         '#FAF5EC',
  surfaceElevated: '#FFFFFF',
  border:          '#DDD0B8',
  borderStrong:    '#C4B49A',

  // ── Chart-specific ───────────────────────────────────────────
  chartPrimary:    '#1B6CA8',
  chartSecondary:  '#4A90C4',
  chartAccent:     '#2FAE7A',
  chartGrid:       '#E8D9C0',
  chartText:       '#5A4A32',
};

export const Typography = {
  fontSerif:  'Georgia',
  fontSans:   'System',
  fontMono:   'Courier',
  heading1:   { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  heading2:   { fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  heading3:   { fontFamily: 'Georgia', fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  body:       { fontSize: 14, color: Colors.textPrimary },
  bodySmall:  { fontSize: 12, color: Colors.textSecondary },
  caption:    { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.8 },
  mono:       { fontFamily: 'Courier', fontSize: 13 },
  label:      { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.textTertiary, fontFamily: 'Georgia' },
} as const;

export const Shadows = {
  card: {
    shadowColor: '#A0906A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#806040',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 99,
};

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
};

export default Colors;
