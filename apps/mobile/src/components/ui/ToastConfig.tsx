import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Toast, { type BaseToastProps } from "react-native-toast-message";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Tone = { icon: typeof Info; color: string; soft: string };

const TONES: Record<"success" | "error" | "info" | "warning", Tone> = {
  success: { icon: CircleCheck, color: p.green, soft: p.greenSoft },
  error: { icon: CircleAlert, color: p.red, soft: p.redSoft },
  info: { icon: Info, color: p.blue, soft: p.blueSoft },
  warning: { icon: TriangleAlert, color: p.amber, soft: p.amberSoft },
};

function ToastCard({ text1, text2, onPress, tone }: BaseToastProps & { tone: Tone }) {
  const Icon = tone.icon;
  return (
    <Pressable
      onPress={onPress ?? (() => Toast.hide())}
      style={styles.card}
      accessibilityRole="alert"
      accessibilityLabel={[text1, text2].filter(Boolean).join(". ")}
    >
      <View style={[styles.accent, { backgroundColor: tone.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: tone.soft }]}>
        <Icon size={20} color={tone.color} strokeWidth={2.4} />
      </View>
      <View style={styles.body}>
        {text1 ? (
          <Text style={styles.title} numberOfLines={2}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text style={styles.message} numberOfLines={3}>
            {text2}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const toastConfig = {
  success: (props: BaseToastProps) => <ToastCard {...props} tone={TONES.success} />,
  error: (props: BaseToastProps) => <ToastCard {...props} tone={TONES.error} />,
  info: (props: BaseToastProps) => <ToastCard {...props} tone={TONES.info} />,
  warning: (props: BaseToastProps) => <ToastCard {...props} tone={TONES.warning} />,
};

const styles = StyleSheet.create({
  card: {
    width: "92%",
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingRight: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.md,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B2E",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontWeight: "700", fontSize: 14, lineHeight: 19 },
  message: { color: p.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
