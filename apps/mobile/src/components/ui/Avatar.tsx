import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UsersRound } from "lucide-react-native";

const SWATCHES = [
  { bg: "#FFEDD5", fg: "#C2410C" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#F3E8FF", fg: "#7E22CE" },
  { bg: "#FCE7F3", fg: "#BE185D" },
  { bg: "#FEF9C3", fg: "#A16207" },
  { bg: "#CCFBF1", fg: "#0F766E" },
];

function swatchFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return SWATCHES[Math.abs(hash) % SWATCHES.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Props = {
  name: string;
  seed?: string;
  size?: number;
  variant?: "person" | "group";
  icon?: IconComponent;
  shape?: "circle" | "rounded";
};

export function Avatar({ name, seed, size = 48, variant = "person", icon: Icon, shape = "circle" }: Props) {
  const swatch = swatchFor(seed || name);
  const box = {
    width: size,
    height: size,
    borderRadius: shape === "rounded" ? size * 0.3 : size / 2,
    backgroundColor: swatch.bg,
  };
  return (
    <View style={[styles.base, box]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Icon ? (
        <Icon size={size * 0.46} color={swatch.fg} strokeWidth={2.2} />
      ) : variant === "group" ? (
        <UsersRound size={size * 0.46} color={swatch.fg} strokeWidth={2.2} />
      ) : (
        <Text style={[styles.initials, { color: swatch.fg, fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  initials: { fontWeight: "800", letterSpacing: 0.3 },
});
