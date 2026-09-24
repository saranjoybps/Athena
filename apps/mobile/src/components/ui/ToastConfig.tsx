import { StyleSheet, Text, View } from "react-native";
import type { BaseToastProps } from "react-native-toast-message";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

function ToastCard({
  text1,
  text2,
  accent,
  bg,
  border,
}: BaseToastProps & { accent: string; bg: string; border: string }) {
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        {text1 ? <Text style={[styles.title, { color: accent }]}>{text1}</Text> : null}
        {text2 ? <Text style={styles.sub}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <ToastCard {...props} accent={p.green} bg="#ECFDF5" border="#A7F3D0" />
  ),
  error: (props: BaseToastProps) => (
    <ToastCard {...props} accent={p.red} bg="#FEF2F2" border="#FECACA" />
  ),
  info: (props: BaseToastProps) => (
    <ToastCard {...props} accent={p.clay} bg={p.claySoft} border="#FDBA74" />
  ),
};

const styles = StyleSheet.create({
  card: {
    width: "92%",
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    marginHorizontal: "4%",
  },
  bar: { width: 5 },
  body: { flex: 1, paddingVertical: 12, paddingHorizontal: spacing.md, justifyContent: "center" },
  title: { fontWeight: "800", fontSize: 14 },
  sub: { color: p.muted, marginTop: 2, fontSize: 13, lineHeight: 18 },
});
