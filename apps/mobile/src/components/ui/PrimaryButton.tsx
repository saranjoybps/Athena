import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { cardShadow, lightPalette as p, radius } from "@/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "ghost" | "soft";
  showArrow?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  tone = "primary",
  showArrow,
  style,
}: Props) {
  const isPrimary = tone === "primary";
  const isSoft = tone === "soft";
  return (
    <Pressable
      style={[
        styles.btn,
        isPrimary && styles.primary,
        isSoft && styles.soft,
        tone === "ghost" && styles.ghost,
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : p.clay} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, !isPrimary && styles.labelDark]}>{label}</Text>
          {showArrow ? <ArrowRight size={18} color={isPrimary ? "#fff" : p.clay} strokeWidth={2.6} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: p.clay,
    ...cardShadow,
  },
  soft: {
    backgroundColor: p.claySoft,
    borderWidth: 1,
    borderColor: p.clayMid,
  },
  ghost: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: "#fff", fontWeight: "800", fontSize: 16 },
  labelDark: { color: p.clayDark },
});
