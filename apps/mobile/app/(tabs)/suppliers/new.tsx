import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { lightPalette as p } from "@/lib/theme";

export default function SuppliersRemoved() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(tabs)/more" as never);
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.background }}>
      <ActivityIndicator color={p.clay} />
    </View>
  );
}
