import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  /** Max share of the screen height the sheet may use. */
  maxHeight?: number;
  /** Fill the whole allowed height instead of sizing to the content. */
  fill?: boolean;
  scroll?: boolean;
  children: React.ReactNode;
};

/** Sheet that slides up from the bottom; drag the handle down or tap outside to close. */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  footer,
  maxHeight = 0.88,
  fill,
  scroll = true,
  children,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translate = useRef(new Animated.Value(height)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translate.setValue(height);
      Animated.parallel([
        Animated.timing(translate, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translate, { toValue: height, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translate.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 1.1) onClose();
        else Animated.spring(translate, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const Body = scroll ? ScrollView : View;
  return (
    <Modal transparent visible onRequestClose={onClose} statusBarTranslucent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * maxHeight, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY: translate }] },
          fill && { height: height * maxHeight },
        ]}
      >
        <View {...pan.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight}
            <Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <X size={18} color={p.text} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>
        <Body
          style={fill || scroll ? { flexShrink: 1, flexGrow: fill ? 1 : 0 } : undefined}
          contentContainerStyle={scroll ? styles.body : undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Body>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17, 12, 34, 0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: p.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: p.borderStrong, marginTop: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: { color: p.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: p.muted, fontSize: 13, fontWeight: "600", marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: p.border,
    backgroundColor: p.surface,
  },
});
