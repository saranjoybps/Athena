/** Athena mobile design tokens — clay/sand brand aligned with web */
export const lightPalette = {
  background: "#f5f0e8",
  surface: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  faint: "#a8a29e",
  border: "#e7e5e4",
  clay: "#c2410c",
  claySoft: "#fff7ed",
  blue: "#2563eb",
  blueSoft: "#eaf2ff",
  green: "#16a34a",
  greenSoft: "#eaf8ef",
  orange: "#ea580c",
  orangeSoft: "#fff7ed",
  purple: "#7c3aed",
  purpleSoft: "#f2edff",
  red: "#dc2626",
  redSoft: "#fff1f2",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  slateSoft: "#f5f5f4",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 };

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
};

export const cardShadow = {
  shadowColor: "#1c1917",
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
