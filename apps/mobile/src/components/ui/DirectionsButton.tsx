import { Pressable, StyleSheet } from "react-native";
import { Navigation } from "lucide-react-native";
import { mapsUrlFor, openMaps } from "@/lib/maps";
import { lightPalette as p } from "@/lib/theme";

type Props = {
  place: Parameters<typeof mapsUrlFor>[0];
  address?: string;
  label?: string;
  size?: number;
};

/** Round direction button that opens the location in Google Maps. */
export function DirectionsButton({ place, address, label = "location", size = 36 }: Props) {
  const url = mapsUrlFor(place, address);
  if (!url) return null;
  return (
    <Pressable
      onPress={() => openMaps(url)}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Directions to ${label}`}
    >
      <Navigation size={Math.round(size * 0.46)} color={p.blue} strokeWidth={2.2} fill={p.blue} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: p.sky, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
