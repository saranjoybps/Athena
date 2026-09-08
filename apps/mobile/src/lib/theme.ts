/** Athena mobile — modern white / orange design tokens */
export const lightPalette = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  faint: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  // Primary brand orange
  clay: "#EA580C",
  clayDark: "#C2410C",
  claySoft: "#FFF7ED",
  clayMid: "#FFEDD5",
  // Semantic (kept quiet; prefer orange for emphasis)
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  orange: "#EA580C",
  orangeSoft: "#FFF7ED",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
  slateSoft: "#F1F5F9",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 9999 };

export const typography = {
  h1: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.2 },
};

export const cardShadow = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const softShadow = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};
