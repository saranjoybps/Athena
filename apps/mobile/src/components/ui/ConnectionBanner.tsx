import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { getApiBaseUrl } from "@/lib/config";
import { lightPalette as p } from "@/lib/theme";

/** Lightweight reachability check — no native NetInfo dep required for APK builds. */
export function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const probe = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
      const res = await fetch(`${base}/health`, { method: "GET", signal: controller.signal });
      setOffline(!res.ok);
      if (res.ok) setDismissed(false);
    } catch {
      setOffline(true);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    probe();
    const id = setInterval(probe, 20_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") probe();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [probe]);

  if (!offline || dismissed) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Can't reach API — check Wi‑Fi / Settings URL</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={12}>
        <Text style={styles.dismiss}>Hide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: p.amber,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 },
  dismiss: { color: "#fff", fontWeight: "600", fontSize: 13, opacity: 0.9 },
});
