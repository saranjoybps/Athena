/** Athena mobile — soft glass / orange design tokens (mockup-inspired) */
export const lightPalette = {
  background: "#F6F4F8",
  surface: "#FFFFFF",
  surfaceSoft: "rgba(255,255,255,0.88)",
  text: "#1E1B2E",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "#EEEAF3",
  borderStrong: "#E2DCEB",
  // Primary brand orange
  clay: "#F97316",
  clayDark: "#EA580C",
  claySoft: "#FFF7ED",
  clayMid: "#FFEDD5",
  // Soft pastel accents (mockup-style cards)
  peach: "#FFE8D6",
  mint: "#E8F8F2",
  lilac: "#F3E8FF",
  butter: "#FFF6D8",
  sky: "#E8F1FF",
  // Semantic
  blue: "#3B82F6",
  blueSoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  orange: "#F97316",
  orangeSoft: "#FFF7ED",
  purple: "#8B5CF6",
  purpleSoft: "#F5F3FF",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  slateSoft: "#F3F4F6",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/** Extra scroll padding so last content clears the full-width tab bar + FAB. */
export const tabBarClearance = 120;

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, full: 9999 };

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.2 },
};

export const cardShadow = {
  shadowColor: "#1E1B2E",
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

export const softShadow = {
  shadowColor: "#1E1B2E",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const fabShadow = {
  shadowColor: "#F97316",
  shadowOpacity: 0.35,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};
