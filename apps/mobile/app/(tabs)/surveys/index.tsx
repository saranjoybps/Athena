import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function SurveysRedirect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <ScreenHeader title="Surveys" onBack={() => router.back()} />
        <Text style={styles.body}>Surveys live inside a site. Open Sites, pick a location, then use the Surveys tab.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/sites")}>
          <Text style={styles.btnText}>Go to Sites</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg },
  body: { color: p.muted, marginBottom: spacing.lg, lineHeight: 22 },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
