/**
 * Design tokens derived from quickamsterdam.nl branding.
 * Primary: #1E5FA0 (Quick blue)  ·  Accent: #E1FF00 (Quick lime)
 * Fonts on site: Poppins / Work Sans / Roboto
 */

export const M3 = {
  // Primary tonal (Quick blue #1E5FA0)
  primary: '#1E5FA0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D4E5F7',
  onPrimaryContainer: '#001C3B',

  // Accent (Quick lime #E1FF00)
  accent: '#E1FF00',
  onAccent: '#1A1A00',

  // Secondary tonal
  secondary: '#44546A',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D9E3F8',
  onSecondaryContainer: '#121C2B',

  // Surface system
  surface: '#FAFAFA',
  surfaceDim: '#D8DAE0',
  surfaceContainer: '#F0F0F0',
  surfaceContainerHigh: '#E8E8E8',
  surfaceContainerHighest: '#E3E3E3',
  onSurface: '#1A1A1A',
  onSurfaceVariant: '#44474E',

  // Outline
  outline: '#74777F',
  outlineVariant: '#C4C6D0',

  // Status
  success: '#146B3A',
  successContainer: '#A3F5BF',
  onSuccess: '#FFFFFF',
  absent: '#AA0A28',
  absentContainer: '#FFDAD6',
  warning: '#7B5800',
  warningContainer: '#FFDEA1',

  // Inverse (for dark surfaces)
  inverseSurface: '#1A1D23',
  inverseOnSurface: '#EFF0F7',
  inversePrimary: '#A5C8FF',

  // Scrim
  scrim: 'rgba(0,0,0,0.32)',
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/**
 * M3 type scale tokens.
 * See https://m3.material.io/styles/typography/type-scale-tokens
 */
export const typography = {
  headlineMedium: { fontSize: 28, fontWeight: '400' as const, lineHeight: 36, letterSpacing: 0 },
  headlineSmall: { fontSize: 24, fontWeight: '400' as const, lineHeight: 32, letterSpacing: 0 },
  titleLarge: { fontSize: 22, fontWeight: '400' as const, lineHeight: 28, letterSpacing: 0 },
  titleMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, lineHeight: 16, letterSpacing: 0.5 },
};
