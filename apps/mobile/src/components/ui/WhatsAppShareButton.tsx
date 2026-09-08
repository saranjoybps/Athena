import { Pressable, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { MessageCircle } from "lucide-react-native";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { lightPalette as p, radius } from "@/lib/theme";

export function WhatsAppShareButton({
  phone,
  message,
  label = "Share on WhatsApp",
}: {
  phone?: string | null;
  message: string;
  label?: string;
}) {
  async function onPress() {
    try {
      await shareViaWhatsApp({ phone, message });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Could not open WhatsApp",
        text2: (e as Error)?.message,
      });
    }
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.btn}
      hitSlop={8}
    >
      <MessageCircle size={20} color="#25D366" strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: p.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: p.border,
  },
});
