import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { goBackOr } from "@/lib/nav";
import { lightPalette as p, radius, spacing, typography } from "@/lib/theme";

export default function SurveysRedirect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <ScreenHeader title="Surveys" onBack={() => goBackOr(router, "/(tabs)/customers")} />
        <Text style={styles.body}>Surveys belong to a site. Open a customer, pick the site, then record a survey from its Surveys tab.</Text>
        <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/customers")}>
          <Text style={styles.btnText}>Go to Customers</Text>
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
