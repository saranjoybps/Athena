import { View, Text, StyleSheet, Pressable } from "react-native";
import { lightPalette, spacing } from "@/lib/theme";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: lightPalette.redSoft,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  text: { color: lightPalette.red, fontSize: 14 },
  retry: { color: lightPalette.clay, fontWeight: "700", marginTop: 8 },
});
